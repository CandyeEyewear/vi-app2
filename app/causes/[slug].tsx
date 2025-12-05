/**
 * Cause Detail Screen
 * Displays full cause details with donation options
 * File: app/causes/[id].tsx
 * 
 * Modern UI with:
 * - Responsive design (mobile app, mobile web, desktop)
 * - Shimmer skeleton loading
 * - Glassmorphic elements
 * - Gradient buttons with animations
 * - Enhanced progress visualization
 * - Elevated cards with proper shadows
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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const getResponsiveValues = () => {
  const width = Dimensions.get('window').width;
  
  // Breakpoints
  const isSmallMobile = width < 380;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  return {
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    // Content width constraints for larger screens
    maxContentWidth: isDesktop ? 800 : isTablet ? 700 : '100%',
    // Spacing scale
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
      xxl: isSmallMobile ? 24 : 32,
    },
    // Typography scale
    fontSize: {
      xs: isSmallMobile ? 11 : 12,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 16 : 17,
      xl: isSmallMobile ? 18 : 20,
      xxl: isSmallMobile ? 22 : 26,
      hero: isSmallMobile ? 26 : isTablet ? 32 : 36,
    },
    // Hero image height
    heroHeight: isDesktop ? 400 : isTablet ? 350 : 300,
    // Button sizes
    buttonHeight: isSmallMobile ? 48 : 52,
    // Card padding
    cardPadding: isSmallMobile ? 12 : 16,
  };
};

// ============================================================================
// CATEGORY CONFIGURATION (using new Colors system)
// ============================================================================
const getCategoryConfig = (category: CauseCategory, colors: typeof Colors.light) => {
  const configs: Record<CauseCategory, { label: string; color: string; softColor: string; textColor: string; emoji: string }> = {
    disaster_relief: { 
      label: 'Disaster Relief', 
      color: colors.disaster,
      softColor: colors.disasterSoft,
      textColor: colors.disasterText,
      emoji: '🆘' 
    },
    education: { 
      label: 'Education', 
      color: colors.education,
      softColor: colors.educationSoft,
      textColor: colors.educationText,
      emoji: '📚' 
    },
    healthcare: { 
      label: 'Healthcare', 
      color: colors.healthcare,
      softColor: colors.healthcareSoft,
      textColor: colors.healthcareText,
      emoji: '🏥' 
    },
    environment: { 
      label: 'Environment', 
      color: colors.environment,
      softColor: colors.environmentSoft,
      textColor: colors.environmentText,
      emoji: '🌱' 
    },
    community: { 
      label: 'Community', 
      color: colors.community,
      softColor: colors.communitySoft,
      textColor: colors.communityText,
      emoji: '🏘️' 
    },
    poverty: { 
      label: 'Poverty Relief', 
      color: colors.poorRelief,
      softColor: colors.poorReliefSoft,
      textColor: colors.poorReliefText,
      emoji: '💝' 
    },
    other: { 
      label: 'Other', 
      color: colors.textSecondary,
      softColor: colors.surfaceElevated,
      textColor: colors.textSecondary,
      emoji: '📋' 
    },
  };
  return configs[category] || configs.other;
};

// ============================================================================
// SHIMMER SKELETON COMPONENT
// ============================================================================
function ShimmerEffect({ style, colors }: { style?: any; colors: typeof Colors.light }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
        {
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

function DetailSkeleton({ colors }: { colors: typeof Colors.light }) {
  const responsive = getResponsiveValues();

  return (
    <View style={styles.skeletonContainer}>
      {/* Hero Image Skeleton */}
      <ShimmerEffect 
        colors={colors} 
        style={[styles.skeletonImage, { height: responsive.heroHeight }]} 
      />
      
      {/* Content Skeleton */}
      <View style={[
        styles.skeletonContent, 
        { 
          paddingHorizontal: responsive.spacing.md,
          paddingTop: 24,
          marginTop: -24,
          backgroundColor: colors.background,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }
      ]}>
        {/* Title */}
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonTitle, { borderRadius: 8 }]} 
        />
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonTitle, { width: '60%', marginTop: 8, borderRadius: 8 }]} 
        />
        
        {/* Progress Card */}
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonProgressCard, { 
            borderRadius: 16, 
            marginTop: responsive.spacing.md 
          }]} 
        />
        
        {/* Buttons */}
        <View style={[styles.skeletonButtonRow, { marginTop: responsive.spacing.md }]}>
          <ShimmerEffect 
            colors={colors} 
            style={[styles.skeletonButton, { borderRadius: 14 }]} 
          />
          <ShimmerEffect 
            colors={colors} 
            style={[styles.skeletonButton, { borderRadius: 14 }]} 
          />
        </View>
        
        {/* Description */}
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonSectionTitle, { marginTop: responsive.spacing.xl, borderRadius: 6 }]} 
        />
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonText, { marginTop: 12, borderRadius: 4 }]} 
        />
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonText, { marginTop: 8, borderRadius: 4 }]} 
        />
        <ShimmerEffect 
          colors={colors} 
          style={[styles.skeletonText, { width: '75%', marginTop: 8, borderRadius: 4 }]} 
        />
      </View>
    </View>
  );
}

// ============================================================================
// GLASSMORPHIC HEADER BUTTON
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
        style={styles.headerButtonContainer}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={[styles.headerButton, styles.headerButtonBlur]}
          >
            {children}
          </BlurView>
        ) : (
          <View style={[
            styles.headerButton, 
            { 
              backgroundColor: colorScheme === 'dark' 
                ? 'rgba(30, 41, 59, 0.9)' 
                : 'rgba(255, 255, 255, 0.9)',
              borderColor: colors.border,
              borderWidth: 1,
            }
          ]}>
            {children}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// ANIMATED PROGRESS BAR
// ============================================================================
function AnimatedProgressBar({ 
  progress, 
  colors 
}: { 
  progress: number; 
  colors: typeof Colors.light;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const isComplete = progress >= 100;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    // Animate progress fill
    Animated.timing(progressAnim, {
      toValue: Math.min(progress, 100),
      duration: 1200,
      useNativeDriver: false,
    }).start();

    // Glow animation for near-complete
    if (progress >= 80) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [progress]);

  const width = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.progressBarWrapper}>
      {/* Background track */}
      <View style={[
        styles.progressTrack, 
        { backgroundColor: isDark ? colors.surface2 : colors.surfaceElevated }
      ]}>
        {/* Inner shadow effect */}
        <View style={[styles.progressTrackInner, { backgroundColor: colors.shadow }]} />
      </View>
      
      {/* Progress fill */}
      <Animated.View style={[styles.progressFillContainer, { width }]}>
        <LinearGradient
          colors={isComplete 
            ? [colors.success, colors.successDark] 
            : [colors.primary, colors.primaryDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.progressFill}
        />
        
        {/* Glow effect for high progress */}
        {progress >= 80 && (
          <Animated.View 
            style={[
              styles.progressGlow, 
              { 
                opacity: glowOpacity,
                backgroundColor: isComplete ? colors.success : colors.primary,
              }
            ]} 
          />
        )}
      </Animated.View>
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
  colors 
}: { 
  icon: any; 
  value: string | number; 
  label: string; 
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: colors.primarySoft }]}>
        <Icon size={16} color={colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

// ============================================================================
// DONATE BUTTON WITH GRADIENT
// ============================================================================
function DonateButton({ 
  onPress, 
  icon: Icon, 
  label, 
  variant = 'primary',
  colors,
}: { 
  onPress: () => void; 
  icon: any; 
  label: string; 
  variant?: 'primary' | 'secondary';
  colors: typeof Colors.light;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const responsive = getResponsiveValues();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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

  if (variant === 'primary') {
    return (
      <Animated.View style={[styles.donateButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.donateButtonPressable}
        >
          <LinearGradient
            colors={Colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.donateButton, { height: responsive.buttonHeight }]}
          >
            <Icon size={20} color="#FFFFFF" />
            <Text style={styles.donateButtonText}>{label}</Text>
          </LinearGradient>
        </Pressable>
        {/* Shadow layer */}
        <View style={[styles.buttonShadow, { backgroundColor: colors.primary }]} />
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
          styles.donateButton,
          styles.secondaryButton,
          { 
            height: responsive.buttonHeight,
            backgroundColor: colors.background,
            borderColor: colors.primary,
          }
        ]}
      >
        <Icon size={20} color={colors.primary} />
        <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
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
    ? 'Anonymous' 
    : donation.donorName || donation.user?.fullName || 'Supporter';

  return (
    <View style={[
      styles.donorItem, 
      !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider }
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
        <View style={[styles.anonymousAvatar, { backgroundColor: colors.surfaceElevated }]}>
          <User size={22} color={colors.textTertiary} />
        </View>
      )}
      
      <View style={styles.donorInfo}>
        <Text style={[styles.donorName, { color: colors.text }]}>
          {displayName}
        </Text>
        {donation.message && (
          <Text 
            style={[styles.donorMessage, { color: colors.textSecondary }]} 
            numberOfLines={2}
          >
            "{donation.message}"
          </Text>
        )}
      </View>
      
      {/* Amount Badge */}
      <View style={[styles.amountBadge, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.donorAmount, { color: colors.primaryDark }]}>
          {formatCurrency(donation.amount)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================
function EmptyDonorsState({ colors }: { colors: typeof Colors.light }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
      <Animated.View 
        style={[
          styles.emptyIconContainer, 
          { 
            backgroundColor: colors.primarySoft,
            transform: [{ scale: pulseAnim }],
          }
        ]}
      >
        <Heart size={32} color={colors.primary} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Be the first to donate!
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Your contribution can make a difference
      </Text>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CauseDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slugParam = params.slug;
  const id = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const responsive = getResponsiveValues();

  // State
  const [cause, setCause] = useState<Cause | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDonations, setLoadingDonations] = useState(true);

  // Scroll animation for header
  const scrollY = useRef(new Animated.Value(0)).current;

  // Fetch cause data
  const fetchCause = useCallback(async () => {
    if (!id) return;

    try {
      const response = await getCauseById(id, user?.id);
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

  // Header background opacity based on scroll
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, responsive.heroHeight - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Loading state
  if (loading || !cause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={[
          styles.header, 
          { paddingTop: insets.top + 8 }
        ]}>
          <HeaderButton onPress={() => router.back()} colors={colors}>
            <ArrowLeft size={22} color={colors.text} />
          </HeaderButton>
        </View>

        <DetailSkeleton colors={colors} />
      </View>
    );
  }

  const progress = getCauseProgress(cause);
  const daysRemaining = getCauseDaysRemaining(cause);
  const categoryConfig = getCategoryConfig(cause.category, colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Animated Header Background */}
      <Animated.View 
        style={[
          styles.headerBackground, 
          { 
            paddingTop: insets.top,
            backgroundColor: colors.background,
            opacity: headerBgOpacity,
            borderBottomColor: colors.border,
          }
        ]} 
      />

      {/* Floating Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <HeaderButton onPress={() => router.back()} colors={colors}>
          <ArrowLeft size={22} color={colors.text} />
        </HeaderButton>
        <HeaderButton onPress={handleShare} colors={colors}>
          <Share2 size={22} color={colors.text} />
        </HeaderButton>
      </View>

      <WebContainer>
        <Animated.ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
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
          <View style={[styles.imageContainer, { height: responsive.heroHeight }]}>
            {cause.imageUrl ? (
              <Image 
                source={{ uri: cause.imageUrl }} 
                style={styles.heroImage} 
                resizeMode="cover" 
              />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                <Heart size={64} color={colors.textTertiary} />
              </View>
            )}
            
            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
              style={styles.imageGradient}
            />

            {/* Category Badge */}
            <View style={[
              styles.categoryBadge, 
              { backgroundColor: categoryConfig.color }
            ]}>
              <Text style={styles.categoryBadgeText}>
                {categoryConfig.emoji} {categoryConfig.label}
              </Text>
            </View>

            {/* Featured Badge */}
            {cause.isFeatured && (
              <View style={styles.featuredBadge}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.featuredBadgeGradient}
                >
                  <Sparkles size={14} color="#000" />
                  <Text style={styles.featuredBadgeText}>Featured</Text>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Content */}
          <View style={[
            styles.content, 
            { 
              backgroundColor: colors.background,
              paddingHorizontal: responsive.spacing.md,
              maxWidth: responsive.maxContentWidth,
              alignSelf: 'center',
              width: '100%',
            }
          ]}>
            {/* Title */}
            <Text style={[
              styles.title, 
              { 
                color: colors.text,
                fontSize: responsive.fontSize.xxl,
              }
            ]}>
              {cause.title}
            </Text>

            {/* Progress Card */}
            <View style={[
              styles.progressCard, 
              { 
                backgroundColor: colors.card,
                shadowColor: colors.shadow,
                borderColor: colors.cardBorder,
              }
            ]}>
              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                    Campaign Progress
                  </Text>
                  <Text style={[
                    styles.progressPercent, 
                    { 
                      color: progress >= 100 ? colors.success : colors.primary,
                    }
                  ]}>
                    {Math.round(progress)}%
                  </Text>
                </View>
                
                <AnimatedProgressBar progress={progress} colors={colors} />
              </View>

              {/* Amount Info */}
              <View style={styles.amountSection}>
                <View style={styles.amountMain}>
                  <Text style={[
                    styles.amountRaised, 
                    { 
                      color: colors.text,
                      fontSize: responsive.fontSize.xl,
                    }
                  ]}>
                    {formatCurrency(cause.amountRaised)}
                  </Text>
                  <Text style={[styles.amountGoal, { color: colors.textSecondary }]}>
                    raised of {formatCurrency(cause.goalAmount)} goal
                  </Text>
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
            </View>

            {/* Donation Buttons */}
            <View style={[
              styles.buttonsContainer, 
              { 
                gap: responsive.spacing.sm,
                flexDirection: responsive.isMobile ? 'column' : 'row',
              }
            ]}>
              <DonateButton
                onPress={handleDonate}
                icon={Heart}
                label="Donate Now"
                variant="primary"
                colors={colors}
              />

              {cause.allowRecurring && (
                <DonateButton
                  onPress={handleRecurringDonate}
                  icon={RefreshCw}
                  label="Monthly Giving"
                  variant="secondary"
                  colors={colors}
                />
              )}
            </View>

            {/* Description Section */}
            <View style={styles.section}>
              <Text style={[
                styles.sectionTitle, 
                { 
                  color: colors.text,
                  fontSize: responsive.fontSize.lg,
                }
              ]}>
                About this Cause
              </Text>
              <Text style={[
                styles.description, 
                { 
                  color: colors.textSecondary,
                  fontSize: responsive.fontSize.md,
                }
              ]}>
                {cause.description}
              </Text>
            </View>

            {/* Details Card */}
            <View style={styles.section}>
              <Text style={[
                styles.sectionTitle, 
                { 
                  color: colors.text,
                  fontSize: responsive.fontSize.lg,
                }
              ]}>
                Details
              </Text>
              <View style={[
                styles.detailsCard, 
                { 
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                }
              ]}>
                {cause.endDate && (
                  <View style={[
                    styles.detailRow, 
                    { borderBottomColor: colors.divider }
                  ]}>
                    <View style={[styles.detailIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                      <Calendar size={16} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Campaign ends
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {new Date(cause.endDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                )}
                
                <View style={[
                  styles.detailRow, 
                  cause.minimumDonation > 0 && { borderBottomColor: colors.divider }
                ]}>
                  <View style={[styles.detailIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                    <Target size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Fundraising goal
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatCurrency(cause.goalAmount)}
                  </Text>
                </View>
                
                {cause.minimumDonation > 0 && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                      <Heart size={16} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Minimum donation
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
              <View style={[styles.section, { marginBottom: insets.bottom + 24 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[
                    styles.sectionTitle, 
                    { 
                      color: colors.text,
                      fontSize: responsive.fontSize.lg,
                      marginBottom: 0,
                    }
                  ]}>
                    Recent Donors
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
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                    }
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
                  <EmptyDonorsState colors={colors} />
                )}
              </View>
            )}
          </View>
        </Animated.ScrollView>
      </WebContainer>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  // Container
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 99,
    borderBottomWidth: 1,
  },
  headerButtonContainer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonBlur: {
    overflow: 'hidden',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  // Hero Image
  imageContainer: {
    position: 'relative',
    width: '100%',
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
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },

  // Badges
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  featuredBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Content
  content: {
    flex: 1,
    paddingTop: 32,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Title
  title: {
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 34,
    letterSpacing: -0.3,
  },

  // Progress Card
  progressCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressBarWrapper: {
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 7,
  },
  progressTrackInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.3,
  },
  progressFillContainer: {
    height: '100%',
    borderRadius: 7,
    overflow: 'hidden',
  },
  progressFill: {
    flex: 1,
    borderRadius: 7,
  },
  progressGlow: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    width: 20,
    borderRadius: 10,
    opacity: 0.5,
  },

  // Amount Section
  amountSection: {},
  amountMain: {
    marginBottom: 16,
  },
  amountRaised: {
    fontWeight: '700',
    marginBottom: 4,
  },
  amountGoal: {
    fontSize: 14,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Buttons
  buttonsContainer: {
    marginBottom: 28,
  },
  donateButtonWrapper: {
    flex: 1,
    position: 'relative',
  },
  donateButtonPressable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    gap: 10,
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonShadow: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    right: 8,
    height: 20,
    borderRadius: 14,
    opacity: 0.25,
    zIndex: -1,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: -8,
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    lineHeight: 26,
    letterSpacing: 0.1,
  },

  // Details Card
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Donors
  donorsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  donorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  anonymousAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorInfo: {
    flex: 1,
    gap: 4,
  },
  donorName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  donorMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  amountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  donorAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingDonors: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
  },
  skeletonImage: {
    width: '100%',
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonTitle: {
    height: 28,
    width: '85%',
  },
  skeletonProgressCard: {
    height: 180,
    width: '100%',
  },
  skeletonButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonButton: {
    flex: 1,
    height: 52,
  },
  skeletonSectionTitle: {
    height: 20,
    width: '40%',
  },
  skeletonText: {
    height: 16,
    width: '100%',
  },
});
