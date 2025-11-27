/**
 * Cause Detail Screen
 * Displays full cause details with donation options
 * File: app/causes/[id].tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useColorScheme,
  RefreshControl,
  Share,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Share2,
  Heart,
  Users,
  Clock,
  Calendar,
  Target,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  User,
  MessageCircle,
} from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import {
  Cause,
  Donation,
  CauseCategory,
  DONOR_BADGE_INFO,
} from '../../types';
import {
  getCauseById,
  getCauseDonations,
  getCauseProgress,
  getCauseDaysRemaining,
  formatCurrency,
} from '../../services/causesService';
import { useAuth } from '../../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Category configuration
const CATEGORY_CONFIG: Record<CauseCategory, { label: string; color: string; emoji: string }> = {
  disaster_relief: { label: 'Disaster Relief', color: '#E53935', emoji: '🆘' },
  education: { label: 'Education', color: '#1E88E5', emoji: '📚' },
  healthcare: { label: 'Healthcare', color: '#43A047', emoji: '🏥' },
  environment: { label: 'Environment', color: '#7CB342', emoji: '🌱' },
  community: { label: 'Community', color: '#FB8C00', emoji: '🏘️' },
  poverty: { label: 'Poverty Relief', color: '#8E24AA', emoji: '💝' },
  other: { label: 'Other', color: '#757575', emoji: '📋' },
};

// Skeleton loader
function DetailSkeleton({ colors }: { colors: any }) {
  return (
    <View style={styles.skeletonContainer}>
      <View style={[styles.skeletonImage, { backgroundColor: colors.border }]} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonTitle, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonText, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonText, { backgroundColor: colors.border, width: '60%' }]} />
        <View style={[styles.skeletonProgress, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonButton, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

// Donor item component
function DonorItem({ donation, colors }: { donation: Donation; colors: any }) {
  const displayName = donation.isAnonymous 
    ? 'Anonymous' 
    : donation.donorName || donation.user?.fullName || 'Supporter';

  return (
    <View style={[styles.donorItem, { borderBottomColor: colors.border }]}>
      <View style={[styles.donorAvatar, { backgroundColor: colors.border }]}>
        {donation.user?.avatarUrl ? (
          <Image source={{ uri: donation.user.avatarUrl }} style={styles.donorAvatarImage} />
        ) : (
          <User size={20} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.donorInfo}>
        <Text style={[styles.donorName, { color: colors.text }]}>
          {displayName}
        </Text>
        {donation.message && (
          <Text style={[styles.donorMessage, { color: colors.textSecondary }]} numberOfLines={2}>
            "{donation.message}"
          </Text>
        )}
      </View>
      <Text style={[styles.donorAmount, { color: '#38B6FF' }]}>
        {formatCurrency(donation.amount)}
      </Text>
    </View>
  );
}

export default function CauseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [cause, setCause] = useState<Cause | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDonations, setLoadingDonations] = useState(true);

  // Fetch cause data
  const fetchCause = useCallback(async () => {
    if (!id) return;

    try {
      const response = await getCauseById(id);
      if (response.success && response.data) {
        setCause(response.data);
      } else {
        Alert.alert('Error', 'Failed to load cause details');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching cause:', error);
      Alert.alert('Error', 'Something went wrong');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // Fetch recent donations
  const fetchDonations = useCallback(async () => {
    if (!id) return;

    try {
      setLoadingDonations(true);
      const response = await getCauseDonations(id, { limit: 5 });
      if (response.success && response.data) {
        setDonations(response.data);
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoadingDonations(false);
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

  // Share cause
  const handleShare = useCallback(async () => {
    if (!cause) return;

    try {
      const progress = getCauseProgress(cause);
      const message = `Support "${cause.title}" - ${Math.round(progress)}% funded!\n\n${cause.description.substring(0, 100)}...\n\nDonate now on Volunteers Inc!`;
      
      await Share.share({
        message,
        title: `Support: ${cause.title}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [cause]);

  // Navigate to donate
  const handleDonate = useCallback(() => {
    if (!id) return;
    router.push(`/causes/${id}/donate`);
  }, [id, router]);

  // Navigate to recurring donate
  const handleRecurringDonate = useCallback(() => {
    if (!id) return;
    router.push(`/causes/${id}/donate?recurring=true`);
  }, [id, router]);

  // Loading state
  if (loading || !cause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <DetailSkeleton colors={colors} />
      </View>
    );
  }

  const progress = getCauseProgress(cause);
  const daysRemaining = getCauseDaysRemaining(cause);
  const categoryConfig = CATEGORY_CONFIG[cause.category] || CATEGORY_CONFIG.other;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: 'transparent' }]}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.card }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.card }]}
          onPress={handleShare}
        >
          <Share2 size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#38B6FF"
          />
        }
      >
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          {cause.imageUrl ? (
            <Image source={{ uri: cause.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
              <Heart size={60} color={colors.textSecondary} />
            </View>
          )}
          
          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
            <Text style={styles.categoryBadgeText}>
              {categoryConfig.emoji} {categoryConfig.label}
            </Text>
          </View>

          {/* Featured Badge */}
          {cause.isFeatured && (
            <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
              <TrendingUp size={14} color="#000" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {cause.title}
          </Text>

          {/* Progress Section */}
          <View style={[styles.progressSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress}%`,
                      backgroundColor: progress >= 100 ? '#4CAF50' : '#38B6FF',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressPercent, { color: colors.text }]}>
                {Math.round(progress)}%
              </Text>
            </View>

            {/* Amount Info */}
            <View style={styles.amountRow}>
              <View>
                <Text style={[styles.amountRaised, { color: colors.text }]}>
                  {formatCurrency(cause.amountRaised)}
                </Text>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                  raised of {formatCurrency(cause.goalAmount)}
                </Text>
              </View>
              <View style={styles.amountDivider} />
              <View style={styles.statItem}>
                <Users size={18} color="#38B6FF" />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {cause.donorCount}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  donors
                </Text>
              </View>
              {daysRemaining !== null && (
                <>
                  <View style={styles.amountDivider} />
                  <View style={styles.statItem}>
                    <Clock size={18} color="#38B6FF" />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {daysRemaining}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      {daysRemaining === 1 ? 'day left' : 'days left'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Donation Buttons */}
          <View style={styles.donateButtonsContainer}>
            <TouchableOpacity
              style={[styles.donateButton, { backgroundColor: '#38B6FF' }]}
              onPress={handleDonate}
              activeOpacity={0.8}
            >
              <Heart size={20} color="#FFFFFF" />
              <Text style={styles.donateButtonText}>Donate Now</Text>
            </TouchableOpacity>

            {cause.allowRecurring && (
              <TouchableOpacity
                style={[styles.recurringButton, { backgroundColor: colors.card, borderColor: '#38B6FF' }]}
                onPress={handleRecurringDonate}
                activeOpacity={0.8}
              >
                <RefreshCw size={20} color="#38B6FF" />
                <Text style={[styles.recurringButtonText, { color: '#38B6FF' }]}>
                  Monthly Giving
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              About this Cause
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {cause.description}
            </Text>
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Details
            </Text>
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {cause.endDate && (
                <View style={styles.detailRow}>
                  <Calendar size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Campaign ends:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(cause.endDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Target size={18} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Goal:
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatCurrency(cause.goalAmount)}
                </Text>
              </View>
              {cause.minimumDonation > 0 && (
                <View style={styles.detailRow}>
                  <Heart size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Minimum donation:
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatCurrency(cause.minimumDonation)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Recent Donors */}
          {cause.isDonationsPublic && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Recent Donors
                </Text>
                {donations.length > 0 && (
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={[styles.viewAllText, { color: '#38B6FF' }]}>
                      View All
                    </Text>
                    <ChevronRight size={16} color="#38B6FF" />
                  </TouchableOpacity>
                )}
              </View>

              {loadingDonations ? (
                <ActivityIndicator size="small" color="#38B6FF" style={styles.loadingDonors} />
              ) : donations.length > 0 ? (
                <View style={[styles.donorsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {donations.map((donation, index) => (
                    <DonorItem
                      key={donation.id}
                      donation={donation}
                      colors={colors}
                    />
                  ))}
                </View>
              ) : (
                <View style={[styles.noDonorsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Heart size={32} color={colors.textSecondary} />
                  <Text style={[styles.noDonorsText, { color: colors.textSecondary }]}>
                    Be the first to donate!
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Bottom spacing for fixed button */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.fixedDonateButton, { backgroundColor: '#38B6FF' }]}
          onPress={handleDonate}
          activeOpacity={0.8}
        >
          <Heart size={22} color="#FFFFFF" />
          <Text style={styles.fixedDonateButtonText}>Donate to this Cause</Text>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 100,
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
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 280,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  featuredBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: isSmallScreen ? 22 : 26,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 32,
  },
  progressSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountRaised: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '700',
  },
  amountLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  amountDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  donateButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  donateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  recurringButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  recurringButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  detailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  donorsCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  donorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  donorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  donorAvatarImage: {
    width: '100%',
    height: '100%',
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
  donorAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  noDonorsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  noDonorsText: {
    fontSize: 14,
  },
  loadingDonors: {
    paddingVertical: 32,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  fixedDonateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  fixedDonateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  // Skeleton styles
  skeletonContainer: {
    flex: 1,
  },
  skeletonImage: {
    height: 280,
    width: '100%',
  },
  skeletonContent: {
    padding: 16,
    gap: 16,
  },
  skeletonTitle: {
    height: 28,
    borderRadius: 4,
    width: '80%',
  },
  skeletonText: {
    height: 16,
    borderRadius: 4,
    width: '100%',
  },
  skeletonProgress: {
    height: 12,
    borderRadius: 6,
    width: '100%',
    marginTop: 16,
  },
  skeletonButton: {
    height: 52,
    borderRadius: 12,
    width: '100%',
    marginTop: 16,
  },
});
