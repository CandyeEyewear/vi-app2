/**
 * Donation History Screen
 * Shows user's one-time and recurring donations
 * File: app/donation-history.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  RefreshCw,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { Donation, RecurringDonation, PaymentStatus, RecurringStatus } from '../types';
import { getUserDonations, getUserRecurringDonations, formatCurrency } from '../services/causesService';
import { useAuth } from '../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Tab options
type TabType = 'one-time' | 'recurring';

// Payment status config
const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: '#FF9800', icon: Clock },
  processing: { label: 'Processing', color: '#2196F3', icon: Clock },
  completed: { label: 'Completed', color: '#4CAF50', icon: CheckCircle },
  failed: { label: 'Failed', color: '#F44336', icon: XCircle },
  cancelled: { label: 'Cancelled', color: '#9E9E9E', icon: AlertCircle },
  refunded: { label: 'Refunded', color: '#9E9E9E', icon: AlertCircle },
};

// Recurring status config
const RECURRING_STATUS_CONFIG: Record<RecurringStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#4CAF50' },
  paused: { label: 'Paused', color: '#FF9800' },
  cancelled: { label: 'Cancelled', color: '#9E9E9E' },
  ended: { label: 'Ended', color: '#2196F3' },
  failed: { label: 'Failed', color: '#F44336' },
};

// Frequency labels
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

// One-time donation item
function DonationItem({ donation, colors, onPress }: { donation: Donation; colors: any; onPress: () => void }) {
  const statusConfig = PAYMENT_STATUS_CONFIG[donation.paymentStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <TouchableOpacity
      style={[styles.donationItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.donationHeader}>
        <View style={styles.donationInfo}>
          <Text style={[styles.causeName, { color: colors.text }]} numberOfLines={1}>
            {donation.cause?.title || 'Unknown Cause'}
          </Text>
          <Text style={[styles.donationDate, { color: colors.textSecondary }]}>
            {new Date(donation.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: colors.text }]}>
            {formatCurrency(donation.amount)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <StatusIcon size={12} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
      </View>

      {donation.message && (
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
          "{donation.message}"
        </Text>
      )}

      <View style={styles.donationFooter}>
        <View style={styles.footerLeft}>
          {donation.isAnonymous && (
            <View style={[styles.anonymousBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.anonymousText, { color: colors.textSecondary }]}>Anonymous</Text>
            </View>
          )}
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

// Recurring donation item
function RecurringItem({ donation, colors, onPress }: { donation: RecurringDonation; colors: any; onPress: () => void }) {
  const statusConfig = RECURRING_STATUS_CONFIG[donation.status];

  return (
    <TouchableOpacity
      style={[styles.donationItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.donationHeader}>
        <View style={styles.donationInfo}>
          <View style={styles.recurringTitleRow}>
            <RefreshCw size={14} color="#38B6FF" />
            <Text style={[styles.causeName, { color: colors.text }]} numberOfLines={1}>
              {donation.cause?.title || 'Unknown Cause'}
            </Text>
          </View>
          <Text style={[styles.donationDate, { color: colors.textSecondary }]}>
            {FREQUENCY_LABELS[donation.frequency]} • Started {new Date(donation.startDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: colors.text }]}>
            {formatCurrency(donation.amount)}
            <Text style={[styles.perPeriod, { color: colors.textSecondary }]}>
              /{donation.frequency === 'monthly' ? 'mo' : donation.frequency === 'weekly' ? 'wk' : donation.frequency === 'annually' ? 'yr' : ''}
            </Text>
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <TrendingUp size={14} color={colors.textSecondary} />
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {formatCurrency(donation.totalDonated)} total
          </Text>
        </View>
        <View style={styles.statItem}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {donation.donationCount} payments
          </Text>
        </View>
      </View>

      {donation.nextBillingDate && donation.status === 'active' && (
        <Text style={[styles.nextBilling, { color: colors.textSecondary }]}>
          Next billing: {new Date(donation.nextBillingDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      )}

      <View style={styles.donationFooter}>
        <View style={styles.footerLeft}>
          {donation.isAnonymous && (
            <View style={[styles.anonymousBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.anonymousText, { color: colors.textSecondary }]}>Anonymous</Text>
            </View>
          )}
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

export default function DonationHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('one-time');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [recurringDonations, setRecurringDonations] = useState<RecurringDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const totalDonated = donations
    .filter(d => d.paymentStatus === 'completed')
    .reduce((sum, d) => sum + d.amount, 0);
  
  const totalRecurring = recurringDonations
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + d.totalDonated, 0);

  const activeRecurring = recurringDonations.filter(d => d.status === 'active').length;

  // Fetch donations
  const fetchDonations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [donationsRes, recurringRes] = await Promise.all([
        getUserDonations(user.id, { limit: 50 }),
        getUserRecurringDonations(user.id),
      ]);

      if (donationsRes.success && donationsRes.data) {
        setDonations(donationsRes.data);
      }

      if (recurringRes.success && recurringRes.data) {
        setRecurringDonations(recurringRes.data);
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDonations();
  }, [fetchDonations]);

  // Navigate to cause
  const handleDonationPress = useCallback((causeId?: string) => {
    if (causeId) {
      router.push(`/causes/${causeId}`);
    }
  }, [router]);

  // Render one-time donation
  const renderDonation = ({ item }: { item: Donation }) => (
    <DonationItem
      donation={item}
      colors={colors}
      onPress={() => handleDonationPress(item.causeId)}
    />
  );

  // Render recurring donation
  const renderRecurring = ({ item }: { item: RecurringDonation }) => (
    <RecurringItem
      donation={item}
      colors={colors}
      onPress={() => handleDonationPress(item.causeId)}
    />
  );

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;
    
    const isOneTime = activeTab === 'one-time';
    return (
      <View style={styles.emptyContainer}>
        {isOneTime ? (
          <Heart size={48} color={colors.textSecondary} />
        ) : (
          <RefreshCw size={48} color={colors.textSecondary} />
        )}
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No {isOneTime ? 'donations' : 'recurring donations'} yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {isOneTime 
            ? 'When you donate to a cause, it will appear here'
            : 'Set up monthly giving to support causes you care about'
          }
        </Text>
        <TouchableOpacity
          style={[styles.browseButton, { backgroundColor: '#38B6FF' }]}
          onPress={() => router.push('/(tabs)/discover')}
        >
          <Text style={styles.browseButtonText}>Browse Causes</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Not logged in
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Donations</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Heart size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to view donations</Text>
          <TouchableOpacity
            style={[styles.browseButton, { backgroundColor: '#38B6FF' }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.browseButtonText}>Sign In</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Donations</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#38B6FF' }]}>
            {formatCurrency(totalDonated + totalRecurring)}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Total Donated
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {donations.filter(d => d.paymentStatus === 'completed').length}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Donations
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: activeRecurring > 0 ? '#4CAF50' : colors.text }]}>
            {activeRecurring}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Active Monthly
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'one-time' && styles.tabActive]}
          onPress={() => setActiveTab('one-time')}
        >
          <Heart size={18} color={activeTab === 'one-time' ? '#38B6FF' : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'one-time' ? '#38B6FF' : colors.textSecondary }]}>
            One-time ({donations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recurring' && styles.tabActive]}
          onPress={() => setActiveTab('recurring')}
        >
          <RefreshCw size={18} color={activeTab === 'recurring' ? '#38B6FF' : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'recurring' ? '#38B6FF' : colors.textSecondary }]}>
            Recurring ({recurringDonations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading donations...
          </Text>
        </View>
      ) : (
        <>
          {activeTab === 'one-time' ? (
            <FlatList
              data={donations}
              renderItem={renderDonation}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38B6FF" />
              }
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <FlatList
              data={recurringDonations}
              renderItem={renderRecurring}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38B6FF" />
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
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
  summaryCard: {
    flexDirection: 'row',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#38B6FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  donationItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  donationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  donationInfo: {
    flex: 1,
    marginRight: 12,
  },
  recurringTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  causeName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  donationDate: {
    fontSize: 13,
    marginTop: 4,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  perPeriod: {
    fontSize: 12,
    fontWeight: '400',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  nextBilling: {
    fontSize: 12,
    marginBottom: 8,
  },
  donationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  anonymousBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  anonymousText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  browseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
