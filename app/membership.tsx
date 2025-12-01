/**
 * Membership Screen
 * Shows membership status, benefits, and subscription management
 * File: app/membership.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCircle,
  Crown,
  Star,
  Calendar,
  CreditCard,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Shield,
  Award,
  TrendingUp,
  Shirt,
  Users,
  Zap,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { MEMBERSHIP_PLANS, formatCurrency, cancelSubscription, isConfigured } from '../services/ezeepayService';
import { supabase } from '../services/supabase';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

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

interface MembershipData {
  tier: 'free' | 'premium';
  status: 'inactive' | 'active' | 'expired' | 'cancelled';
  subscriptionId?: string;
  subscriptionPlan?: 'monthly' | 'yearly';
  startDate?: string;
  expiresAt?: string;
  nextBillingDate?: string;
}

export default function MembershipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, refreshUser } = useAuth();

  // State
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Fetch membership data
  const fetchMembership = useCallback(async () => {
    if (!user?.id) return;

    try {
      const isOrganization = user.account_type === 'organization';
      
      // For organizations, check payment_subscriptions table
      if (isOrganization) {
        const { data: subscriptionData, error: subError } = await supabase
          .from('payment_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('subscription_type', 'organization_membership')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (subError && subError.code !== 'PGRST116') {
          console.error('Error fetching organization subscription:', subError);
        }

        setMembership({
          tier: user.is_partner_organization ? 'premium' : 'free',
          status: user.membership_status || 'inactive',
          subscriptionId: subscriptionData?.ezee_subscription_id || subscriptionData?.id,
          startDate: subscriptionData?.created_at,
          expiresAt: subscriptionData?.next_billing_date,
        });
      } else {
        // For individuals, use existing logic
        const { data, error } = await supabase
          .from('users')
          .select('membership_tier, membership_status, membership_expires_at, subscription_start_date, revenuecat_user_id')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // Note: revenuecat_user_id is being repurposed as ezee subscription_id
        setMembership({
          tier: data.membership_tier || 'free',
          status: data.membership_status || 'inactive',
          subscriptionId: data.revenuecat_user_id,
          startDate: data.subscription_start_date,
          expiresAt: data.membership_expires_at,
        });
      }
    } catch (error) {
      console.error('Error fetching membership:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.account_type, user?.is_partner_organization, user?.membership_status]);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  // Cancel subscription
  const handleCancelSubscription = useCallback(async () => {
    if (!user?.id) return;
    
    const isOrganization = user.account_type === 'organization';
    const membershipType = isOrganization ? 'partner organization membership' : 'premium membership';
    
    Alert.alert(
      `Cancel ${isOrganization ? 'Partner Membership' : 'Membership'}`,
      `Are you sure you want to cancel your ${membershipType}? You will lose access to all benefits at the end of your billing period.${isOrganization ? ' Your golden badge will be removed.' : ''}`,
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Membership',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              // If payment system is not configured or no subscriptionId, update database directly
              if (!isConfigured() || !membership.subscriptionId) {
                // Demo mode or direct cancellation - update database directly
                const updateData: any = {
                  membership_status: 'cancelled',
                  membership_tier: 'free',
                };
                
                if (isOrganization) {
                  updateData.is_partner_organization = false;
                } else {
                  updateData.is_premium = false;
                }
                
                const { error: updateError } = await supabase
                  .from('users')
                  .update(updateData)
                  .eq('id', user?.id);

                if (updateError) throw updateError;

                // Refresh user context
                if (refreshUser) await refreshUser();
                
                Alert.alert(
                  'Membership Cancelled',
                  isConfigured() 
                    ? 'Your membership will remain active until the end of your current billing period.'
                    : 'Your membership has been cancelled. In production, you would retain access until the end of your billing period.',
                  [{ text: 'OK', onPress: fetchMembership }]
                );
                setCancelling(false);
                return;
              }

              // Production mode with subscriptionId - cancel via payment provider
              // Use paymentService for organization subscriptions
              if (isOrganization) {
                const { cancelSubscription: cancelSub } = await import('../services/paymentService');
                const result = await cancelSub(membership.subscriptionId, user.id);
                
                if (result.success) {
                  // Refresh user context
                  if (refreshUser) await refreshUser();

                  Alert.alert(
                    'Membership Cancelled',
                    'Your partner membership will remain active until the end of your current billing period.',
                    [{ text: 'OK', onPress: fetchMembership }]
                  );
                } else {
                  throw new Error(result.error);
                }
              } else {
                // Individual membership
                const result = await cancelSubscription(membership.subscriptionId);
                
                if (result.success) {
                  // Update local database
                  const { error: updateError } = await supabase
                    .from('users')
                    .update({
                      membership_status: 'cancelled',
                      membership_tier: 'free',
                      is_premium: false,
                    })
                    .eq('id', user?.id);

                  if (updateError) throw updateError;

                  // Refresh user context
                  if (refreshUser) await refreshUser();

                  Alert.alert(
                    'Membership Cancelled',
                    'Your membership will remain active until the end of your current billing period.',
                    [{ text: 'OK', onPress: fetchMembership }]
                  );
                } else {
                  throw new Error(result.error);
                }
              }
            } catch (error) {
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', 'Failed to cancel membership. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }, [membership, user?.id, user?.account_type, fetchMembership, refreshUser]);

  // Navigate to subscribe
  const handleSubscribe = useCallback(() => {
    router.push('/membership/subscribe');
  }, [router]);

  // Not logged in
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Membership</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>Sign in to view membership</Text>
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

  // Loading
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Membership</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
        </View>
      </View>
    );
  }

  const isOrganization = user?.account_type === 'organization';
  const isPremium = isOrganization 
    ? (user?.is_partner_organization && membership?.status === 'active')
    : (membership?.tier === 'premium' && membership?.status === 'active');
  const isCancelled = membership?.status === 'cancelled';
  const isExpired = membership?.status === 'expired';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Membership</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <View style={[
          styles.statusCard,
          { 
            backgroundColor: isPremium ? '#38B6FF' : colors.card,
            borderColor: isPremium ? '#38B6FF' : colors.border,
          }
        ]}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusIconContainer,
              { backgroundColor: isPremium ? 'rgba(255,255,255,0.2)' : colors.border }
            ]}>
              {isPremium ? (
                <Crown size={32} color="#FFFFFF" />
              ) : (
                <Shield size={32} color={colors.textSecondary} />
              )}
            </View>
            <View style={styles.statusInfo}>
              <Text style={[
                styles.statusTitle,
                { color: isPremium ? '#FFFFFF' : colors.text }
              ]}>
                {isPremium 
                  ? (isOrganization ? 'Partner Organization' : 'Premium Member')
                  : (isOrganization ? 'Organization' : 'Free Member')}
              </Text>
              <Text style={[
                styles.statusSubtitle,
                { color: isPremium ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
              ]}>
                {isPremium 
                  ? isCancelled 
                    ? 'Cancellation pending'
                    : 'Your membership is active'
                  : isExpired
                    ? 'Your membership has expired'
                    : 'Upgrade to unlock all features'
                }
              </Text>
            </View>
          </View>

          {/* Membership Details */}
          {isPremium && (
            <View style={styles.membershipDetails}>
              {membership?.startDate && (
                <View style={styles.detailRow}>
                  <Calendar size={16} color={isPremium ? 'rgba(255,255,255,0.8)' : colors.textSecondary} />
                  <Text style={[styles.detailText, { color: isPremium ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                    Member since {new Date(membership.startDate).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              {membership?.expiresAt && (
                <View style={styles.detailRow}>
                  <RefreshCw size={16} color={isPremium ? 'rgba(255,255,255,0.8)' : colors.textSecondary} />
                  <Text style={[styles.detailText, { color: isPremium ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                    {isCancelled ? 'Access until' : 'Renews on'} {new Date(membership.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Action Button */}
          {!isPremium && (
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: '#38B6FF' }]}
              onPress={handleSubscribe}
            >
              <Crown size={20} color="#FFFFFF" />
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Benefits Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {isPremium ? 'Your Benefits' : 'Premium Benefits'}
          </Text>

          <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {MEMBERSHIP_PLANS.monthly.benefits.map((benefit, index) => {
              const IconComponent = BENEFIT_ICONS[benefit] || Star;
              return (
                <View
                  key={index}
                  style={[
                    styles.benefitItem,
                    index < MEMBERSHIP_PLANS.monthly.benefits.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }
                  ]}
                >
                  <View style={[styles.benefitIcon, { backgroundColor: '#38B6FF' + '15' }]}>
                    <IconComponent size={18} color="#38B6FF" />
                  </View>
                  <Text style={[styles.benefitText, { color: colors.text }]}>
                    {benefit}
                  </Text>
                  {isPremium && (
                    <CheckCircle size={18} color="#4CAF50" />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Pricing Section (for non-premium) */}
        {!isPremium && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Choose Your Plan
            </Text>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleSubscribe}
            >
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.text }]}>Monthly</Text>
                  <Text style={[styles.planPrice, { color: '#38B6FF' }]}>
                    {formatCurrency(MEMBERSHIP_PLANS.monthly.price)}
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/month</Text>
                  </Text>
                </View>
                <ChevronRight size={24} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>

            {/* Yearly Plan */}
            <TouchableOpacity
              style={[styles.planCard, { backgroundColor: colors.card, borderColor: '#38B6FF' }]}
              onPress={handleSubscribe}
            >
              <View style={styles.planHeader}>
                <View>
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, { color: colors.text }]}>Yearly</Text>
                    {/* <View style={[styles.savingsBadge, { backgroundColor: '#4CAF50' }]}>
                      <Text style={styles.savingsText}>Save 17%</Text>
                    </View> */}
                  </View>
                  <Text style={[styles.planPrice, { color: '#38B6FF' }]}>
                    {formatCurrency(MEMBERSHIP_PLANS.yearly.price)}
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/year</Text>
                  </Text>
                </View>
                <ChevronRight size={24} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Manage Subscription (for premium) */}
        {isPremium && !isCancelled && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Manage Subscription
            </Text>

            <View style={[styles.manageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.manageItem}
                onPress={() => Alert.alert('Payment Method', 'Payment method management coming soon!')}
              >
                <CreditCard size={20} color={colors.textSecondary} />
                <Text style={[styles.manageText, { color: colors.text }]}>Update Payment Method</Text>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={[styles.manageDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.manageItem}
                onPress={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#F44336" />
                ) : (
                  <AlertCircle size={20} color="#F44336" />
                )}
                <Text style={[styles.manageText, { color: '#F44336' }]}>Cancel Membership</Text>
                <ChevronRight size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Reactivate (for cancelled/expired) */}
        {(isCancelled || isExpired) && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.reactivateButton, { backgroundColor: '#38B6FF' }]}
              onPress={handleSubscribe}
            >
              <RefreshCw size={20} color="#FFFFFF" />
              <Text style={styles.reactivateButtonText}>
                {isCancelled ? 'Reactivate Membership' : 'Renew Membership'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: isSmallScreen ? 20 : 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
  },
  membershipDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  benefitsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
  },
  planCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: '400',
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  manageCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  manageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  manageText: {
    flex: 1,
    fontSize: 15,
  },
  manageDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  reactivateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
