/**
 * Donors List Screen
 * Displays comprehensive list of all donors for a cause
 * File: app/causes/[id]/donors.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  User,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Cause, Donation } from '../../../types';
import {
  getCauseById,
  getCauseDonations,
  formatCurrency,
} from '../../../services/causesService';
import WebContainer from '../../../components/WebContainer';
import { UserAvatar } from '../../../components';

// Donor item component
function DonorItem({ donation, colors }: { donation: Donation; colors: any }) {
  const displayName = donation.isAnonymous 
    ? 'Anonymous' 
    : donation.donorName || donation.user?.fullName || 'Supporter';

  return (
    <View style={[styles.donorItem, { borderBottomColor: colors.border }]}>
      {!donation.isAnonymous && donation.user ? (
        <UserAvatar
          avatarUrl={donation.user.avatarUrl || null}
          fullName={donation.user.fullName || displayName}
          size={44}
          role={donation.user.role || 'volunteer'}
          membershipTier={donation.user.membershipTier || 'free'}
          membershipStatus={donation.user.membershipStatus || 'inactive'}
        />
      ) : (
        <View style={[styles.donorAvatar, { backgroundColor: colors.border }]}>
          <User size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.donorInfo}>
        <Text style={[styles.donorName, { color: colors.text }]}>
          {displayName}
        </Text>
        {donation.message && (
          <Text style={[styles.donorMessage, { color: colors.textSecondary }]} numberOfLines={2}>
            "{donation.message}"
          </Text>
        )}
        {donation.createdAt && (
          <Text style={[styles.donorDate, { color: colors.textSecondary }]}>
            {new Date(donation.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        )}
      </View>
      <Text style={[styles.donorAmount, { color: '#38B6FF' }]}>
        {formatCurrency(donation.amount)}
      </Text>
    </View>
  );
}

export default function DonorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // State
  const [cause, setCause] = useState<Cause | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch cause data
  const fetchCause = useCallback(async () => {
    if (!id) return;

    try {
      const response = await getCauseById(id);
      if (response.success && response.data) {
        setCause(response.data);
      }
    } catch (error) {
      console.error('Error fetching cause:', error);
    }
  }, [id]);

  // Fetch all donations
  const fetchDonations = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch all donations without limit
      const response = await getCauseDonations(id, { includeAnonymous: false });
      if (response.success && response.data) {
        setDonations(response.data);
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchCause();
    fetchDonations();
  }, [fetchCause, fetchDonations]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCause(), fetchDonations()]);
    setRefreshing(false);
  }, [fetchCause, fetchDonations]);

  // Render donor item
  const renderDonor = ({ item }: { item: Donation }) => (
    <DonorItem donation={item} colors={colors} />
  );

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Heart size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No donors yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Be the first to support this cause!
        </Text>
      </View>
    );
  };

  return (
    <WebContainer>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              All Donors
            </Text>
            {cause && (
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {cause.title}
              </Text>
            )}
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38B6FF" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading donors...
            </Text>
          </View>
        ) : (
          <FlatList
            data={donations}
            renderItem={renderDonor}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              donations.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#38B6FF"
              />
            }
            style={styles.list}
          />
        )}
      </View>
    </WebContainer>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
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
  donorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
    backgroundColor: 'transparent',
  },
  donorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  donorInfo: {
    flex: 1,
  },
  donorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  donorMessage: {
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  donorDate: {
    fontSize: 12,
    marginTop: 4,
  },
  donorAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 48,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});

