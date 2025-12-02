/**
 * Cause Detail Screen
 * Displays full cause details with donation options
 * File: app/causes/[id].tsx
 * 
 * Visual Enhancements:
 * - Shimmer skeleton loading
 * - Glassmorphic floating header
 * - Gradient progress bar with glow
 * - Elevated cards with shadows
 * - Premium donate buttons
 * - Hero image gradient overlay
 * - Polished donor list
 * - 8px grid spacing system
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  Sparkles,
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
import WebContainer from '../../components/WebContainer';
import { UserAvatar } from '../../components';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 380;

// ============================================================================
// DESIGN TOKENS
// ============================================================================
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }),
};

// ============================================================================
// CATEGORY CONFIGURATION (Using new color system)
// ============================================================================
const getCategoryConfig = (category: CauseCategory, colors: typeof Colors.light) => {
  const configs: Record<CauseCategory, { label: string; emoji: string; color: string; softColor: string }> = {
    disaster_relief: { 
      label: 'Disaster Relief', 
      emoji: '🆘', 
      color: colors.disaster,
      softColor: colors.disasterSoft,
    },
    education: { 
      label: 'Education', 
      emoji: '📚', 
      color: colors.education,
      softColor: colors.educationSoft,
    },
    healthcare: { 
      label: 'Healthcare', 
      emoji: '🏥', 
      color: colors.healthcare,
      softColor: colors.healthcareSoft,
    },
    environment: { 
      label: 'Environment', 
      emoji: '🌱', 
      color: colors.environment,
      softColor: colors.environmentSoft,
    },
    community: { 
      label: 'Community', 
      emoji: '🏘️', 
      color: colors.community,
      softColor: colors.communitySoft,
    },
    poverty: { 
      label: 'Poverty Relief', 
      emoji: '💝', 
      color: colors.poorRelief,
      softColor: colors.poorReliefSoft,
    },
    other: { 
      label: 'Other', 
      emoji: '📋', 
      color: colors.textSecondary,
      softColor: colors.surfaceElevated,
    },
  };
  return configs[category] || configs.other;
};

// ============================================================================
// SHIMMER SKELETON COMPONENT
// ============================================================================
function ShimmerEffect({ colors, style }: { colors: typeof Colors.light; style?: any }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth, screenWidth],
  });

  return (
    <View style={[styles.shimmerContainer, style]}>
      <View style={[styles.shimmerBase, { backgroundColor: colors.skeleton }]} />
      <Animated.View
        style={[
          styles.shimmerOverlay,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', colors.skeletonHighlight, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function DetailSkeleton({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={styles.skeletonContainer}>
      {/* Hero Image Skeleton */}
      <ShimmerEffect colors={colors} style={styles.skeletonImage} />
      
      {/* Content Skeleton */}
      <View style={[styles.skeletonContent, { backgroundColor: colors.background }]}>
        {/* Title */}
        <ShimmerEffect colors={colors} style={styles.skeletonTitle} />
        <ShimmerEffect colors={colors} style={[styles.skeletonTitle, { width: '60%' }]} />
        
        {/* Progress Card */}
        <View style={[styles.skeletonCard, { backgroundColor: colors.surface }]}>
          <ShimmerEffect colors={colors} style={styles.skeletonProgress} />
          <View style={styles.skeletonStatsRow}>
            <ShimmerEffect colors={colors} style={styles.skeletonStat} />
            <ShimmerEffect colors={colors} style={styles.skeletonStat} />
            <ShimmerEffect colors={colors} style={styles.skeletonStat} />
          </View>
        </View>
        
        {/* Buttons */}
        <View style={styles.skeletonButtonRow}>
          <ShimmerEffect colors={colors} style={styles.skeletonButton} />
          <ShimmerEffect colors={colors} style={styles.skeletonButton} />
        </View>
        
        {/* Description */}
        <ShimmerEffect colors={colors} style={styles.skeletonText} />
        <ShimmerEffect colors={colors} style={styles.skeletonText} />
        <ShimmerEffect colors={colors} style={[styles.skeletonText, { width: '80%' }]} />
      </View>
    </View>
  );
}

// ============================================================================
// GLASSMORPHIC HEADER BUTTON
// ============================================================================
function HeaderButton({ 
  onPress, 
  icon: Icon, 
  colors,
  colorScheme,
}: { 
  onPress: () => void; 
  icon: any; 
  colors: typeof Colors.light;
  colorScheme: 'light' | 'dark';
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        style={styles.headerButtonWrapper}
      >
        <BlurView
          intensity={80}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={styles.headerButtonBlur}
        >
          <View style={[
            styles.headerButtonInner,
            { 
              backgroundColor: colorScheme === 'dark' 
                ? 'rgba(30, 41, 59, 0.7)' 
                : 'rgba(255, 255, 255, 0.8)',
              borderColor: colors.border,
            }
          ]}>
            <Icon size={22} color={colors.text} />
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// ANIMATED PROGRESS BAR
// ============================================================================
function AnimatedProgressBar({ 
  progress, 
  colors,
  isComplete,
}: { 
  progress: number; 
  colors: typeof Colors.light;
  isComplete: boolean;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    if (progress >= 80) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 1000, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [progress]);

  const width = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const gradientColors = isComplete 
    ? [colors.success, colors.successDark] as const
    : [colors.primary, colors.primaryDark] as const;

  return (
    <View style={styles.progressBarWrapper}>
      <View style={[styles.progressBarTrack, { backgroundColor: colors.surface2 }]}>
        <Animated.View style={[styles.progressBarFill, { width }]}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ============================================================================
// PREMIUM DONATE BUTTON
// ============================================================================
function DonateButton({ 
  onPress, 
  colors,
  isPrimary = true,
  icon: Icon,
  label,
}: { 
  onPress: () => void; 
  colors: typeof Colors.light;
  isPrimary?: boolean;
  icon: any;
  label: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
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

  if (isPrimary) {
    return (
      <Animated.View style={[styles.donateButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.donateButtonPressable, SHADOWS.glow(colors.primary)]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.donateButtonGradient}
          >
            <Icon size={20} color="#FFFFFF" />
            <Text style={styles.donateButtonTextPrimary}>{label}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.donateButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.donateButtonSecondary,
          { 
            backgroundColor: colors.primarySoft,
            borderColor: colors.primary,
          },
          SHADOWS.sm,
        ]}
      >
        <Icon size={20} color={colors.primary} />
        <Text style={[styles.donateButtonTextSecondary, { color: colors.primary }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// DONOR ITEM COMPONENT
// ============================================================================
function DonorItem({ 
  donation, 
  colors,
  isLast,
}: { 
  donation: Donation; 
  colors: typeof Colors.light;
  isLast: boolean;
}) {
  const displayName = donation.isAnonymous 
    ? 'Anonymous Hero' 
    : donation.donorName || donation.user?.fullName || 'Generous Supporter';

  return (
    <View style={[
      styles.donorItem, 
      !isLast && { borderBottomColor: colors.divider, borderBottomWidth: 1 }
    ]}>
      {!donation.isAnonymous && donation.user ? (
        <UserAvatar
          avatarUrl={donation.user.avatarUrl || null}
          fullName={donation.user.fullName || displayName}
          size={48}
          role={donation.user.role || 'volunteer'}
          membershipTier={donation.user.membershipTier || 'free'}
          membershipStatus={donation.user.membershipStatus || 'inactive'}
        />
      ) : (
        <View style={[styles.donorAvatarAnonymous, { backgroundColor: colors.surface2 }]}>
          <User size={22} color={colors.textTertiary} />
        </View>
      )}
      
      <View style={styles.donorInfo}>
        <Text style={[styles.donorName, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
        {donation.message && (
          <Text style={[styles.donorMessage, { color: colors.textSecondary }]} numberOfLines={2}>
            "{donation.message}"
          </Text>
        )}
      </View>
      
      {/* Amount Badge */}
      <View style={[styles.donorAmountBadge, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.donorAmount, { color: colors.primary }]}>
          {formatCurrency(donation.amount)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// STAT ITEM COMPONENT
// ============================================================================
function StatItem({ 
  icon: Icon, 
  value, 
  label, 
  colors,
}: { 
  icon: any; 
  value: string | number; 
  label: string; 
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: colors.primarySoft }]}>
        <Icon size={18} color={colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CauseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
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
        <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
          <HeaderButton
            onPress={() => router.back()}
            icon={ArrowLeft}
            colors={colors}
            colorScheme={isDark ? 'dark' : 'light'}
          />
        </View>

        <DetailSkeleton colors={colors} />
      </View>
    );
  }

  const progress = getCauseProgress(cause);
  const daysRemaining = getCauseDaysRemaining(cause);
  const categoryConfig = getCategoryConfig(cause.category, colors);
  const isComplete = progress >= 100;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <HeaderButton
          onPress={() => router.back()}
          icon={ArrowLeft}
          colors={colors}
          colorScheme={isDark ? 'dark' : 'light'}
        />
        <HeaderButton
          onPress={handleShare}
          icon={Share2}
          colors={colors}
          colorScheme={isDark ? 'dark' : 'light'}
        />
      </View>

      <WebContainer>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Hero Image */}
          <View style={styles.imageContainer}>
            {cause.imageUrl ? (
              <Image 
                source={{ uri: cause.imageUrl }} 
                style={styles.heroImage} 
                resizeMode="cover" 
              />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.surface2 }]}>
                <Heart size={64} color={colors.textTertiary} />
              </View>
            )}
            
            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)']}
              style={styles.heroGradient}
            />
            
            {/* Category Badge */}
            <View style={styles.badgesContainer}>
              <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
                <Text style={styles.categoryBadgeText}>
                  {categoryConfig.emoji} {categoryConfig.label}
                </Text>
              </View>

              {/* Featured Badge */}
              {cause.isFeatured && (
                <View style={[styles.featuredBadge, { backgroundColor: colors.star }]}>
                  <Sparkles size={14} color="#000" />
                  <Text style={styles.featuredBadgeText}>Featured</Text>
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={[
            styles.content, 
            { 
              backgroundColor: colors.background,
              ...SHADOWS.lg,
            }
          ]}>
            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              {cause.title}
            </Text>

            {/* Progress Section */}
            <View style={[
              styles.progressSection, 
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              SHADOWS.md,
            ]}>
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <AnimatedProgressBar 
                  progress={progress} 
                  colors={colors}
                  isComplete={isComplete}
                />
                <View style={[
                  styles.progressPercentBadge, 
                  { backgroundColor: isComplete ? colors.successSoft : colors.primarySoft }
                ]}>
                  <Text style={[
                    styles.progressPercent, 
                    { color: isComplete ? colors.success : colors.primary }
                  ]}>
                    {Math.round(progress)}%
                  </Text>
                </View>
              </View>

              {/* Amount Info */}
              <View style={styles.amountContainer}>
                <View style={styles.amountMain}>
                  <Text style={[styles.amountRaised, { color: colors.text }]}>
                    {formatCurrency(cause.amountRaised)}
                  </Text>
                  <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                    raised of {formatCurrency(cause.goalAmount)} goal
                  </Text>
                </View>
              </View>

              {/* Stats Row */}
              <View style={[styles.statsRow, { borderTopColor: colors.divider }]}>
                <StatItem 
                  icon={Users} 
                  value={cause.donorCount} 
                  label="donors" 
                  colors={colors}
                />
                {daysRemaining !== null && (
                  <StatItem 
                    icon={Clock} 
                    value={daysRemaining} 
                    label={daysRemaining === 1 ? 'day left' : 'days left'} 
                    colors={colors}
                  />
                )}
              </View>
            </View>

            {/* Donation Buttons */}
            <View style={styles.donateButtonsContainer}>
              <DonateButton
                onPress={handleDonate}
                colors={colors}
                isPrimary={true}
                icon={Heart}
                label="Donate Now"
              />

              {cause.allowRecurring && (
                <DonateButton
                  onPress={handleRecurringDonate}
                  colors={colors}
                  isPrimary={false}
                  icon={RefreshCw}
                  label="Monthly"
                />
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
                Campaign Details
              </Text>
              <View style={[
                styles.detailsCard, 
                { 
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                SHADOWS.sm,
              ]}>
                {cause.endDate && (
                  <View style={[styles.detailRow, { borderBottomColor: colors.divider }]}>
                    <View style={[styles.detailIconContainer, { backgroundColor: colors.surface2 }]}>
                      <Calendar size={18} color={colors.textSecondary} />
                    </View>
                    <View style={styles.detailTextContainer}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Campaign ends
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {new Date(cause.endDate).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                )}
                
                <View style={[
                  styles.detailRow, 
                  cause.minimumDonation > 0 && { borderBottomColor: colors.divider }
                ]}>
                  <View style={[styles.detailIconContainer, { backgroundColor: colors.surface2 }]}>
                    <Target size={18} color={colors.textSecondary} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Fundraising goal
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatCurrency(cause.goalAmount)}
                    </Text>
                  </View>
                </View>
                
                {cause.minimumDonation > 0 && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconContainer, { backgroundColor: colors.surface2 }]}>
                      <Heart size={18} color={colors.textSecondary} />
                    </View>
                    <View style={styles.detailTextContainer}>
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                        Minimum donation
                      </Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {formatCurrency(cause.minimumDonation)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Recent Donors */}
            {cause.isDonationsPublic && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                    Recent Supporters
                  </Text>
                  {donations.length > 0 && (
                    <Pressable 
                      style={({ pressed }) => [
                        styles.viewAllButton,
                        pressed && { opacity: 0.7 }
                      ]}
                      onPress={() => router.push(`/causes/${id}/donors`)}
                    >
                      <Text style={[styles.viewAllText, { color: colors.primary }]}>
                        View All
                      </Text>
                      <ChevronRight size={18} color={colors.primary} />
                    </Pressable>
                  )}
                </View>

                {loadingDonations ? (
                  <View style={styles.loadingDonors}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : donations.length > 0 ? (
                  <View style={[
                    styles.donorsCard, 
                    { 
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    SHADOWS.sm,
                  ]}>
                    {donations.map((donation, index) => (
                      <DonorItem
                        key={donation.id}
                        donation={donation}
                        colors={colors}
                        isLast={index === donations.length - 1}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={[
                    styles.emptyDonorsCard, 
                    { 
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    SHADOWS.sm,
                  ]}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: colors.primarySoft }]}>
                      <Heart size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      Be the first to donate!
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      Your support will kickstart this campaign
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Bottom Spacing */}
            <View style={{ height: insets.bottom + SPACING.xxxl }} />
          </View>
        </ScrollView>
      </WebContainer>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    zIndex: 100,
  },
  headerButtonWrapper: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  headerButtonInner: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  
  // Hero Image
  imageContainer: {
    position: 'relative',
    height: 320,
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
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  badgesContainer: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // Content
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    marginTop: -SPACING.xxl,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
  },
  title: {
    fontSize: isSmallScreen ? 24 : 28,
    fontWeight: '700',
    marginBottom: SPACING.lg,
    lineHeight: isSmallScreen ? 32 : 36,
    letterSpacing: -0.5,
  },
  
  // Progress Section
  progressSection: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  progressBarWrapper: {
    flex: 1,
    height: 12,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  progressBarTrack: {
    flex: 1,
    height: '100%',
    borderRadius: RADIUS.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  progressPercentBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 15,
    fontWeight: '700',
  },
  amountContainer: {
    marginBottom: SPACING.lg,
  },
  amountMain: {},
  amountRaised: {
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  amountLabel: {
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: SPACING.xxl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  
  // Donate Buttons
  donateButtonsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  donateButtonWrapper: {
    flex: 1,
  },
  donateButtonPressable: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  donateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  donateButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  donateButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg - 2,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    gap: SPACING.sm,
  },
  donateButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Sections
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
  },
  
  // Details Card
  detailsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    gap: SPACING.md,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Donors
  donorsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  donorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  donorAvatarAnonymous: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorInfo: {
    flex: 1,
  },
  donorName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  donorMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  donorAmountBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  donorAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Empty State
  emptyDonorsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Loading
  loadingDonors: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  
  // Shimmer Skeleton
  shimmerContainer: {
    overflow: 'hidden',
    borderRadius: RADIUS.sm,
  },
  shimmerBase: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  skeletonContainer: {
    flex: 1,
  },
  skeletonImage: {
    height: 320,
    borderRadius: 0,
  },
  skeletonContent: {
    padding: SPACING.lg,
    marginTop: -SPACING.xxl,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    gap: SPACING.sm,
  },
  skeletonTitle: {
    height: 28,
    width: '85%',
    borderRadius: RADIUS.sm,
  },
  skeletonCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  skeletonProgress: {
    height: 12,
    borderRadius: RADIUS.sm,
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.sm,
  },
  skeletonStat: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
  },
  skeletonButtonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  skeletonButton: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.lg,
  },
  skeletonText: {
    height: 16,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
});
