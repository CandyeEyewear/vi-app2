/**
 * Cause Summary Screen (Admin)
 * Shows detailed summary for a specific cause
 * File: app/(admin)/causes/[id]/summary.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  Heart,
  User,
} from 'lucide-react-native';
import { Colors } from '../../../../constants/colors';
import { Cause, Donation } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import { getCauseById, getCauseDonations, formatCurrency, calculateTotalRaisedAllCauses } from '../../../../services/causesService';
import { useAuth } from '../../../../contexts/AuthContext';

export default function CauseSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, isAdmin } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  // State
  const [cause, setCause] = useState<Cause | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRaisedOverall: 0,
    totalRaisedThisCause: 0,
    totalDonors: 0,
    uniqueDonors: new Set<string>(),
  });

  // Fetch cause and donations
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch cause
      const causeResponse = await getCauseById(id, user?.id);
      if (causeResponse.success && causeResponse.data) {
        setCause(causeResponse.data);
      }

      // Fetch all donations for this cause (including anonymous for admin)
      const donationsResponse = await getCauseDonations(id, {
        includeAnonymous: true,
        limit: 1000, // Get all donations
      });

      if (donationsResponse.success && donationsResponse.data) {
        const allDonations = donationsResponse.data;
        setDonations(allDonations);

        // Calculate stats
        const totalRaisedThisCause = allDonations.reduce(
          (sum, d) => sum + (parseFloat(d.amount.toString()) || 0),
          0
        );

        const uniqueDonors = new Set<string>();
        allDonations.forEach((d) => {
          if (d.userId && !d.isAnonymous) {
            uniqueDonors.add(d.userId);
          }
        });

        // Fetch total raised across all causes using the service function
        const totalRaisedOverall = await calculateTotalRaisedAllCauses();

        setStats({
          totalRaisedOverall,
          totalRaisedThisCause,
          totalDonors: uniqueDonors.size,
          uniqueDonors,
        });
      }
    } catch (error) {
      console.error('Error fetching cause details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cause Summary</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
        </View>
      </View>
    );
  }

  if (loading && !cause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38B6FF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!cause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cause Summary</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Cause not found</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {cause.title} - Summary
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38B6FF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards */}
        <View style={styles.summarySection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>

          {/* Total Raised Overall */}
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#4CAF5020' }]}>
              <TrendingUp size={24} color="#4CAF50" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Raised (All Causes)</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(stats.totalRaisedOverall)}
              </Text>
            </View>
          </View>

          {/* Total Raised This Cause */}
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#38B6FF20' }]}>
              <DollarSign size={24} color="#38B6FF" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Raised (This Cause)</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(stats.totalRaisedThisCause)}
              </Text>
            </View>
          </View>

          {/* Total Donors */}
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#9C27B020' }]}>
              <Users size={24} color="#9C27B0" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Donors</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.totalDonors} {stats.totalDonors === 1 ? 'donor' : 'donors'}
              </Text>
            </View>
          </View>
        </View>

        {/* Donors List */}
        <View style={styles.donorsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Donors ({donations.length} {donations.length === 1 ? 'donation' : 'donations'})
          </Text>

          {donations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Heart size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No donations yet</Text>
            </View>
          ) : (
            donations.map((donation) => (
              <View
                key={donation.id}
                style={[styles.donorCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.donorInfo}>
                  {donation.isAnonymous ? (
                    <>
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                        <User size={20} color={colors.textSecondary} />
                      </View>
                      <View style={styles.donorDetails}>
                        <Text style={[styles.donorName, { color: colors.text }]}>Anonymous Donor</Text>
                        <Text style={[styles.donorDate, { color: colors.textSecondary }]}>
                          {new Date(donation.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      {donation.user?.avatarUrl ? (
                        <View style={styles.avatarContainer}>
                          <Text style={styles.avatarText}>
                            {donation.user.fullName?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                          <User size={20} color={colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.donorDetails}>
                        <Text style={[styles.donorName, { color: colors.text }]}>
                          {donation.user?.fullName || 'Unknown User'}
                        </Text>
                        <Text style={[styles.donorDate, { color: colors.textSecondary }]}>
                          {new Date(donation.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                <Text style={[styles.donationAmount, { color: '#4CAF50' }]}>
                  {formatCurrency(parseFloat(donation.amount.toString()))}
                </Text>
              </View>
            ))
          )}
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  summarySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  donorsSection: {
    marginBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  donorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  donorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#38B6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  donorDetails: {
    flex: 1,
  },
  donorName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  donorDate: {
    fontSize: 12,
  },
  donationAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});

