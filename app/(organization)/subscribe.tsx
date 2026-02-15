/**
 * Organization Subscription Payment Screen
 * Allows approved organizations to complete payment for partner membership
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import {
  ChevronLeft,
  Check,
  Building2,
  Crown,
  AlertCircle,
} from 'lucide-react-native';
import { processSubscription, formatPaymentAmount } from '../../services/paymentService';
import {
  getSubscriptionPlanConfigs,
  type SubscriptionPlanConfig,
} from '../../services/subscriptionPlanConfigService';

const DEFAULT_ORG_FEATURES = [
  'Golden Badge',
  'Full Platform Access',
  'Post Opportunities',
  'Connect with Volunteers',
  'Priority Support',
];

function frequencyToPeriodLabel(frequency: SubscriptionPlanConfig['frequency']): string {
  switch (frequency) {
    case 'daily':
      return '/day';
    case 'weekly':
      return '/week';
    case 'monthly':
      return '/month';
    case 'quarterly':
      return '/quarter';
    case 'annually':
      return '/year';
    default:
      return '/period';
  }
}

export default function OrganizationSubscribeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);

  // Check if user is an organization
  useEffect(() => {
    const load = async () => {
      if (!user) {
        router.replace('/login');
        return;
      }

      // Only organizations with approved status can access this
      if (user.account_type !== 'organization') {
        Alert.alert('Access Denied', 'This page is only for partner organizations.');
        router.back();
        return;
      }

      if (user.approval_status !== 'approved') {
        Alert.alert(
          'Application Pending',
          'Your organization application is still under review. You will be able to complete payment once approved.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      // Check if already paid
      if (user.is_partner_organization) {
        Alert.alert(
          'Already Active',
          'Your organization membership is already active!',
          [{ text: 'OK', onPress: () => router.replace('/feed') }]
        );
        return;
      }

      setPlansLoading(true);
      const result = await getSubscriptionPlanConfigs({
        activeOnly: true,
        subscriptionType: 'organization_membership',
      });
      setPlansLoading(false);

      if (!result.success || !result.data?.length) {
        Alert.alert(
          'Plans Unavailable',
          result.error || 'No active organization subscription plans are configured.'
        );
        return;
      }

      setPlans(result.data);
      const yearlyPlan = result.data.find((p) => p.frequency === 'annually');
      setSelectedPlanId((yearlyPlan || result.data[0]).id);
    };

    load();
  }, [user, router]);

  const handleSubscribe = async () => {
    if (!user) return;

    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;

    Alert.alert(
      'Confirm Subscription',
      `You are about to subscribe to the ${plan.name} for ${formatPaymentAmount(plan.amount, plan.currency)}.\n\nYou will be redirected to our secure payment gateway to complete the transaction.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue to Payment',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await processSubscription({
                amount: plan.amount,
                frequency: plan.frequency,
                subscriptionType: 'organization_membership',  // NEW subscription type
                userId: user.id,
                customerEmail: user.email,
                customerName: user.organization_data?.organization_name || user.fullName,
                description: plan.description || `VIbe Partner Organization - ${plan.name}`,
                platform: 'app',
                returnPath: '/(organization)/profile',
                paymentMethodPreference: plan.paymentMethod,
                manualPaymentLink: plan.manualPaymentLink,
              });

              if (result.success) {
                // Payment page will open automatically
                // User will be redirected back after payment
                console.log('Payment initiated successfully');
              } else {
                Alert.alert('Payment Error', result.error || 'Failed to initiate payment. Please try again.');
              }
            } catch (error: any) {
              console.error('Subscription error:', error);
              Alert.alert('Error', error.message || 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Building2 size={28} color="#FFC107" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Partner Membership</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Crown size={32} color="#FFC107" />
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            Your Application Was Approved!
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Complete your payment to activate your golden badge and unlock full platform access.
          </Text>
        </View>

        {/* Plans */}
        {plansLoading ? (
          <View style={styles.plansLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const isPopular = plan.frequency === 'annually';
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? '#FFC107' : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedPlanId(plan.id)}
                activeOpacity={0.7}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={styles.planNameRow}>
                    <View
                      style={[
                        styles.radioCircle,
                        { borderColor: isSelected ? '#FFC107' : colors.border },
                      ]}
                    >
                      {isSelected && (
                        <View style={[styles.radioCircleSelected, { backgroundColor: '#FFC107' }]} />
                      )}
                    </View>
                    <View>
                      <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                      <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                        {plan.description || 'Partner organization membership plan'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={[styles.price, { color: colors.text }]}>
                      {formatPaymentAmount(plan.amount, plan.currency)}
                    </Text>
                    <Text style={[styles.period, { color: colors.textSecondary }]}>
                      {frequencyToPeriodLabel(plan.frequency)}
                    </Text>
                  </View>
                </View>

                <View style={styles.featuresContainer}>
                  {DEFAULT_ORG_FEATURES.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Check size={16} color="#10B981" />
                      <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[styles.subscribeButton, { backgroundColor: '#FFC107' }]}
          onPress={handleSubscribe}
          disabled={loading || plansLoading || !selectedPlanId}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <>
              <Crown size={20} color="#000000" />
              <Text style={styles.subscribeButtonText}>Activate Partner Membership</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Payment Info */}
        <View style={[styles.paymentInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AlertCircle size={20} color={colors.textSecondary} />
          <Text style={[styles.paymentInfoText, { color: colors.textSecondary }]}>
            Secure payment powered by eZeePayments. Your golden badge will activate immediately after successful payment.
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  plansLoading: {
    paddingVertical: 20,
  },
  infoBanner: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  planCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 20,
    backgroundColor: '#FFC107',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  planDescription: {
    fontSize: 13,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
  },
  period: {
    fontSize: 12,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuresContainer: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  subscribeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentInfo: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    alignItems: 'flex-start',
  },
  paymentInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
