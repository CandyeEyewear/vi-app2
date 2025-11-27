/**
 * Subscribe Screen
 * Payment flow for premium membership subscription
 * File: app/membership/subscribe.tsx
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCircle,
  Crown,
  Star,
  CreditCard,
  Shield,
  Lock,
  ChevronRight,
  Award,
  TrendingUp,
  Shirt,
  Users,
  Zap,
} from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import {
  MEMBERSHIP_PLANS,
  formatCurrency,
} from '../../services/ezeepayService';
import { supabase } from '../../services/supabase';
import { processSubscription, type Frequency } from '../../services/paymentService';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

type PlanType = 'monthly' | 'yearly';

// Benefit icons mapping
const BENEFIT_ICONS: Record<string, any> = {
  'Blue verification tick': CheckCircle,
  'Official Member designation': Award,
  'Propose volunteer opportunities': Users,
  'Customized Blue VI T-Shirt': Shirt,
  'Impact Statistics on profile': TrendingUp,
  'Priority support': Zap,
  'All yearly benefits': Star,
};

export default function SubscribeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, refreshUser } = useAuth();

  // State
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [processing, setProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const plan = MEMBERSHIP_PLANS[selectedPlan];

  // Handle subscription
  const handleSubscribe = useCallback(async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to subscribe.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/login') },
      ]);
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Terms Required', 'Please agree to the terms and conditions.');
      return;
    }

    setProcessing(true);

    try {
      // Map plan to frequency
      const frequency: Frequency = selectedPlan === 'monthly' ? 'monthly' : 'annually';

      // Calculate expiration date
      const expiresAt = new Date();
      if (selectedPlan === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Process subscription payment through eZeePayments
      const subscriptionResult = await processSubscription({
        amount: plan.price,
        frequency,
        subscriptionType: 'membership',
        userId: user.id,
        customerEmail: user.email || '',
        customerName: user.fullName || 'VIbe Member',
        description: `Premium Membership - ${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Plan`,
        endDate: expiresAt.toISOString(),
      });

      if (!subscriptionResult.success) {
        Alert.alert(
          'Payment Error',
          subscriptionResult.error || 'Failed to process subscription. Please try again.',
          [{ text: 'OK' }]
        );
        setProcessing(false);
        return;
      }

      // Store subscription ID and update membership status
      // The status will be updated by webhook when payment is confirmed
      if (subscriptionResult.subscriptionId) {
        await supabase
          .from('users')
          .update({
            revenuecat_user_id: subscriptionResult.subscriptionId,
            membership_status: 'pending', // Will be updated by webhook when payment completes
          })
          .eq('id', user.id);
      }

      Alert.alert(
        'Subscription Processing! 🎉',
        `Your premium membership subscription is being processed. You will receive a confirmation once payment is complete.`,
        [{ text: 'Done', onPress: () => router.replace('/membership') }]
      );
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process subscription. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [user, selectedPlan, agreedToTerms, plan, router, refreshUser]);

  // Not logged in
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Subscribe</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Crown size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>Sign in to subscribe</Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: '#38B6FF' }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Subscribe</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.crownContainer, { backgroundColor: '#38B6FF' + '15' }]}>
            <Crown size={48} color="#38B6FF" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Become a Premium Member
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Support Volunteers Incorporated and unlock exclusive benefits
          </Text>
        </View>

        {/* Plan Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Choose Your Plan
          </Text>

          {/* Monthly Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              { 
                backgroundColor: colors.card,
                borderColor: selectedPlan === 'monthly' ? '#38B6FF' : colors.border,
                borderWidth: selectedPlan === 'monthly' ? 2 : 1,
              }
            ]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <View style={styles.planRadio}>
              <View style={[
                styles.radioOuter,
                { borderColor: selectedPlan === 'monthly' ? '#38B6FF' : colors.border }
              ]}>
                {selectedPlan === 'monthly' && (
                  <View style={[styles.radioInner, { backgroundColor: '#38B6FF' }]} />
                )}
              </View>
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: colors.text }]}>Monthly</Text>
              <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                Billed every month
              </Text>
            </View>
            <View style={styles.planPriceContainer}>
              <Text style={[styles.planPrice, { color: '#38B6FF' }]}>
                {formatCurrency(MEMBERSHIP_PLANS.monthly.price)}
              </Text>
              <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/mo</Text>
            </View>
          </TouchableOpacity>

          {/* Yearly Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              { 
                backgroundColor: colors.card,
                borderColor: selectedPlan === 'yearly' ? '#38B6FF' : colors.border,
                borderWidth: selectedPlan === 'yearly' ? 2 : 1,
              }
            ]}
            onPress={() => setSelectedPlan('yearly')}
          >
            <View style={styles.planRadio}>
              <View style={[
                styles.radioOuter,
                { borderColor: selectedPlan === 'yearly' ? '#38B6FF' : colors.border }
              ]}>
                {selectedPlan === 'yearly' && (
                  <View style={[styles.radioInner, { backgroundColor: '#38B6FF' }]} />
                )}
              </View>
            </View>
            <View style={styles.planInfo}>
              <View style={styles.planNameRow}>
                <Text style={[styles.planName, { color: colors.text }]}>Yearly</Text>
                {/* Uncomment if you add a discount */}
                {/* <View style={[styles.savingsBadge, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.savingsText}>Best Value</Text>
                </View> */}
              </View>
              <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                Billed annually
              </Text>
            </View>
            <View style={styles.planPriceContainer}>
              <Text style={[styles.planPrice, { color: '#38B6FF' }]}>
                {formatCurrency(MEMBERSHIP_PLANS.yearly.price)}
              </Text>
              <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/yr</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            What You Get
          </Text>

          <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {plan.benefits.map((benefit, index) => {
              const IconComponent = BENEFIT_ICONS[benefit] || Star;
              return (
                <View
                  key={index}
                  style={[
                    styles.benefitItem,
                    index < plan.benefits.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }
                  ]}
                >
                  <CheckCircle size={20} color="#4CAF50" />
                  <Text style={[styles.benefitText, { color: colors.text }]}>
                    {benefit}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Order Summary
          </Text>

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                {plan.name}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatCurrency(plan.price)}
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: '#38B6FF' }]}>
                {formatCurrency(plan.price)}
              </Text>
            </View>
            <Text style={[styles.billingNote, { color: colors.textSecondary }]}>
              {selectedPlan === 'monthly' 
                ? 'Billed monthly. Cancel anytime.'
                : 'Billed annually. Cancel anytime.'
              }
            </Text>
          </View>
        </View>

        {/* Terms Agreement */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <View style={[
            styles.checkbox,
            { 
              backgroundColor: agreedToTerms ? '#38B6FF' : 'transparent',
              borderColor: agreedToTerms ? '#38B6FF' : colors.border,
            }
          ]}>
            {agreedToTerms && <CheckCircle size={14} color="#FFFFFF" />}
          </View>
          <Text style={[styles.termsText, { color: colors.textSecondary }]}>
            I agree to the{' '}
            <Text style={{ color: '#38B6FF' }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: '#38B6FF' }}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Lock size={14} color={colors.textSecondary} />
          <Text style={[styles.securityText, { color: colors.textSecondary }]}>
            Secure payment powered by eZeePayments
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Subscribe Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { backgroundColor: '#38B6FF' },
            (!agreedToTerms || processing) && styles.subscribeButtonDisabled,
          ]}
          onPress={handleSubscribe}
          disabled={!agreedToTerms || processing}
          activeOpacity={0.8}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <CreditCard size={22} color="#FFFFFF" />
              <Text style={styles.subscribeButtonText}>
                Subscribe for {formatCurrency(plan.price)}/{selectedPlan === 'monthly' ? 'mo' : 'yr'}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  signInButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  crownContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: isSmallScreen ? 22 : 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  planRadio: {
    marginRight: 12,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planInfo: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
  },
  planDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 14,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  benefitsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 20,
    fontWeight: '700',
  },
  billingNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  subscribeButtonDisabled: {
    opacity: 0.5,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
