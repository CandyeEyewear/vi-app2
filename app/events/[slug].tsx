/**
 * Optimized Event Detail Screen
 * Modern design with professional UI/UX, performance optimizations, and accessibility
 * File: app/events/[slug].tsx
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  RefreshControl,
  Share,
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Share2,
  Calendar,
  MapPin,
  Users,
  Video,
  Ticket,
  Star,
  ExternalLink,
  Phone,
  Mail,
  DollarSign,
  Check,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { EVENT_CATEGORY_CONFIG } from '../../constants/eventCategories';
import { Event, EventRegistration } from '../../types';
import {
  getEventBySlug,
  checkUserRegistration,
  registerForEvent,
  cancelEventRegistration,
  getEventRegistrations,
  formatEventDate,
  formatEventTime,
  getDaysUntilEvent,
  isEventToday,
  isEventPast,
  formatCurrency,
} from '../../services/eventsService';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../utils/toast';
import { logImageDebugInfo } from '../../utils/webImageDebug';
import { goBack } from '../../utils/navigation';
import ErrorBoundary from '../../components/ErrorBoundary';
import Button from '../../components/Button';
import { ShimmerSkeleton } from '../../components/ShimmerSkeleton';
import { addEventToCalendar, createEventDateTime, calculateEndDate } from '../../utils/calendar';
import { CalendarPlus } from 'lucide-react-native';

// ============================================================================
// UTILITIES & CONSTANTS
// ============================================================================

const getPremiumShadow = (colors: any) =>
  Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    web: {
      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
    },
  });

// Responsive System
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
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
      xxl: isSmallMobile ? 24 : 32,
    },
    fontSize: {
      xs: isSmallMobile ? 10 : 11,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 16 : 17,
      xl: isSmallMobile ? 18 : 20,
      xxl: isSmallMobile ? 22 : 26,
      header: isSmallMobile ? 22 : isTablet ? 28 : 26,
    },
  };
};

// Modern Typography Scale
const Typography = {
  title1: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  title2: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body1: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body2: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};

// Modern Spacing System
const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

function useEventDetails(eventSlug: string | undefined) {
  const [event, setEvent] = useState<Event | null>(null);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();

  const fetchEventData = useCallback(async () => {
    if (!eventSlug) return;

    try {
      setLoading(true);
      setError(null);

      const eventResponse = await getEventBySlug(eventSlug);

      if (!eventResponse.success || !eventResponse.data) {
        throw new Error(eventResponse.error || 'Failed to load event details');
      }

      const eventData = eventResponse.data;
      setEvent(eventData);

      const eventId = eventData.id;

      const registrationPromise = user
        ? checkUserRegistration(eventId, user.id)
        : Promise.resolve({ success: true, data: null });

      const registrationsPromise = isAdmin
        ? getEventRegistrations(eventId)
        : Promise.resolve({ success: true, data: [] as EventRegistration[] });

      const [registrationResponse, registrationsResponse] = await Promise.all([
        registrationPromise,
        registrationsPromise,
      ]);

      if (registrationResponse.success) {
        setRegistration(registrationResponse.data || null);
      }

      if (registrationsResponse.success && registrationsResponse.data) {
        const activeRegistrations = registrationsResponse.data.filter(
          (reg) => reg.status !== 'cancelled'
        );
        setRegistrations(activeRegistrations);
      } else {
        setRegistrations([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [eventSlug, user, isAdmin]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  return {
    event,
    registration,
    registrations,
    loading,
    error,
    refetch: fetchEventData,
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Modern Header Component
function EventHeader({
  onBack,
  onShare,
  colors,
}: {
  onBack: () => void;
  onShare: () => void;
  colors: any;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + Spacing.lg,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          getPremiumShadow(colors),
          {
            backgroundColor: colors.card,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to previous screen"
      >
        <ArrowLeft size={24} color={colors.text} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.headerButton,
          getPremiumShadow(colors),
          {
            backgroundColor: colors.card,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share event"
        accessibilityHint="Opens share options for this event"
      >
        <Share2 size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

// Event Image Component with modern loading
function EventImage({ event, colors }: { event: Event; colors: any }) {
  const responsive = getResponsiveValues();
  const heroHeight = responsive.isSmallMobile
    ? 280
    : responsive.isTablet || responsive.isDesktop
    ? 400
    : 320;

  const categoryConfig = EVENT_CATEGORY_CONFIG[event.category] || EVENT_CATEGORY_CONFIG.other;

  // Single imageSource declaration - memoized to prevent recreation on every render
  const imageSource = useMemo(
    () => (event.imageUrl ? { uri: event.imageUrl } : null),
    [event.imageUrl]
  );

  const imageLoadingRef = useRef(true);
  const [imageError, setImageError] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (event.imageUrl) {
      logImageDebugInfo(event.imageUrl, `EventImage: ${event.title}`);
    } else {
      console.log('[EventImage] Event:', event.title, 'No image URL');
    }
  }, [event.imageUrl, event.title]);

  const handleLoadStart = useCallback(() => {
    imageLoadingRef.current = true;
    setShowLoader(true);
    console.log('[EventImage] Image load started:', event.imageUrl);
  }, [event.imageUrl]);

  const handleLoadEnd = useCallback(() => {
    imageLoadingRef.current = false;
    setShowLoader(false);
    console.log('[EventImage] Image load ended successfully:', event.imageUrl);
  }, [event.imageUrl]);

  const handleError = useCallback(
    (error: any) => {
      console.error('[EventImage] Image load error for:', event.title);
      console.error('  URL:', event.imageUrl);
      console.error('  Error:', error.nativeEvent);
      setImageError(true);
      setShowLoader(false);
    },
    [event.title, event.imageUrl]
  );

  return (
    <View style={[styles.imageContainer, { height: heroHeight }]}>
      {imageSource && !imageError ? (
        <>
          <Image
            source={imageSource}
            style={styles.eventImage}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            contentFit="cover"
            accessibilityLabel={`Event image for ${event.title}`}
          />
          {showLoader && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        </>
      ) : (
        <View
          style={[
            styles.placeholderImage,
            {
              backgroundColor: categoryConfig.color,
              height: heroHeight,
            },
          ]}
        >
          <Text style={styles.placeholderEmoji}>{categoryConfig.emoji}</Text>
        </View>
      )}

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
        style={styles.heroGradient}
        pointerEvents="none"
      />

      <View
        style={[
          styles.categoryBadge,
          { backgroundColor: categoryConfig.color },
          getPremiumShadow(colors),
        ]}
      >
        <Text style={[styles.categoryBadgeText, { color: colors.textOnPrimary }]}>
          {categoryConfig.emoji} {categoryConfig.label}
        </Text>
      </View>

      {event.isFeatured && (
        <View
          style={[
            styles.featuredBadge,
            { backgroundColor: colors.eventFeaturedGold },
            getPremiumShadow(colors),
          ]}
        >
          <Star size={14} color={colors.textInverse} fill={colors.textInverse} />
          <Text style={[styles.featuredText, { color: colors.textInverse }]}>Featured</Text>
        </View>
      )}

      <View style={styles.heroMeta}>
        <Text style={[styles.heroTitle, { color: colors.textOnPrimary }]} numberOfLines={2}>
          {event.title}
        </Text>
      </View>
    </View>
  );
}

// Gradient Button Component with animations and depth
function GradientButton({
  onPress,
  icon: Icon,
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  colors,
}: {
  onPress: () => void;
  icon: any;
  label: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  colors: typeof Colors.light;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const gradientColors: [string, string] =
    variant === 'danger' ? [colors.error, colors.errorDark] : [colors.primary, colors.primaryDark];

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.gradientButtonWrapper,
        { transform: [{ scale: scaleAnim }], opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={styles.gradientButtonPressable}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <Icon size={20} color={colors.textOnPrimary} />
              <Text style={[styles.gradientButtonText, { color: colors.textOnPrimary }]}>
                {label}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>

      {!disabled && (
        <View
          style={[
            styles.buttonShadow,
            {
              backgroundColor: gradientColors[0],
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

// Event Info Cards
function EventInfoCard({
  icon,
  title,
  subtitle,
  onPress,
  colors,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  colors: any;
  badge?: React.ReactNode;
}) {
  const responsive = getResponsiveValues();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) =>
    Animated.spring(scaleAnim, {
      toValue: value,
      useNativeDriver: true,
      friction: 6,
    }).start();

  // Make title blue if it's clickable (has onPress) to indicate it's a link
  const titleColor = onPress ? colors.primary : colors.text;

  const cardContent = (
    <Animated.View
      style={[
        styles.infoCard,
        {
          padding: responsive.spacing.lg,
          marginBottom: responsive.spacing.lg,
          backgroundColor: colors.card,
          transform: [{ scale: scaleAnim }],
        },
        getPremiumShadow(colors),
      ]}
    >
      <View style={[styles.infoIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      <View style={styles.infoContent}>
        <View style={styles.infoTitleRow}>
          <Text style={[styles.infoTitle, { color: titleColor }]}>{title}</Text>
          {badge}
        </View>
        {subtitle && (
          <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {onPress && <ExternalLink size={20} color={colors.primary} />}
    </Animated.View>
  );

  if (!onPress) {
    return cardContent;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.98)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
    >
      {cardContent}
    </Pressable>
  );
}

// Registration Status Banner
function RegistrationStatusBanner({
  registration,
  colors,
}: {
  registration: EventRegistration | null;
  colors: any;
}) {
  const responsive = getResponsiveValues();
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [iconScale]);

  if (!registration) return null;

  return (
    <View
      style={[
        styles.statusBanner,
        {
          backgroundColor: colors.successSoft,
          borderLeftColor: colors.success,
          padding: responsive.spacing.lg,
        },
        getPremiumShadow(colors),
      ]}
    >
      <Animated.View
        style={[
          styles.statusIcon,
          {
            backgroundColor: colors.success,
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <Check size={20} color={colors.textOnPrimary} />
      </Animated.View>
      <View style={styles.statusCopy}>
        <Text style={[styles.statusText, { color: colors.successText }]}>
          You're registered for this event
        </Text>
        <Text style={[styles.statusSubtext, { color: colors.textSecondary }]}>
          We'll send reminders and important updates before it begins.
        </Text>
      </View>
    </View>
  );
}

// Error Component
function ErrorScreen({ onRetry, colors }: { onRetry: () => void; colors: any }) {
  return (
    <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
      <AlertCircle size={48} color={colors.textSecondary} />
      <Text style={[styles.errorTitle, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
        We couldn't load the event details. Please try again.
      </Text>
      <Button variant="primary" onPress={onRetry} style={styles.retryButton}>
        Try Again
      </Button>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const responsive = getResponsiveValues();
  const insets = useSafeAreaInsets();
  // Extra padding needed for mobile web browsers
  const webBottomPadding = Platform.OS === 'web' ? 40 : 0;

  const { event, registration, registrations, loading, error, refetch } = useEventDetails(slug);

  const [registering, setRegistering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Memoized calculations
  const eventStatus = useMemo(() => {
    if (!event) return null;

    if (isEventPast(event.eventDate)) return 'past';
    if (isEventToday(event.eventDate)) return 'today';

    const days = getDaysUntilEvent(event.eventDate);
    if (days <= 1) return 'tomorrow';
    if (days <= 7) return 'soon';

    return 'upcoming';
  }, [event]);

  // Event handlers
  const handleShare = useCallback(async () => {
    if (!event) return;

    try {
      const shareUrl = `https://vibe.volunteersinc.org/events/${event.slug}`;
      const message = `Join me at "${event.title}"!\n\n📅 ${formatEventDate(event.eventDate)}\n⏰ ${formatEventTime(event.startTime)}\n📍 ${event.isVirtual ? 'Virtual Event' : event.location}\n\nSave your spot: ${shareUrl}`;

      await Share.share({
        message,
        url: shareUrl,
        title: `Event: ${event.title}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      showToast('Could not share event', 'error');
    }
  }, [event]);

  const handleRegister = useCallback(async () => {
    if (!event) return;

    if (!user) {
      showToast('Please sign in to register for events', 'warning');
      router.push('/login');
      return;
    }

    // If already registered, handle cancellation
    if (registration) {
      const confirmed =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.confirm('Cancel your registration for this event?')
          : true; // Implement proper modal for mobile

      if (!confirmed) return;

      setRegistering(true);
      try {
        const response = await cancelEventRegistration(registration.id);
        if (response.success) {
          showToast('Registration cancelled', 'success');
          refetch();
        } else {
          showToast(response.error || 'Failed to cancel registration', 'error');
        }
      } catch (error) {
        showToast('Something went wrong', 'error');
      } finally {
        setRegistering(false);
      }
      return;
    }

    // For paid events, navigate to registration screen
    if (!event.isFree) {
      router.push(`/events/${event.slug}/register`);
      return;
    }

    // Free event - register directly
    setRegistering(true);
    try {
      const response = await registerForEvent({
        eventId: event.id,
        userId: user.id,
      });

      if (response.success && response.data) {
        showToast('Successfully registered! 🎉', 'success');
        refetch();
      } else {
        showToast(response.error || 'Failed to register', 'error');
      }
    } catch (error) {
      showToast('Something went wrong', 'error');
    } finally {
      setRegistering(false);
    }
  }, [event, user, registration, router, refetch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Location handlers
  const handleOpenMap = useCallback(() => {
    if (!event) return;

    let url: string;
    if (event.mapLink) {
      url = event.mapLink;
    } else if (event.latitude && event.longitude) {
      url = `https://maps.google.com/?q=${event.latitude},${event.longitude}`;
    } else if (event.locationAddress) {
      url = `https://maps.google.com/?q=${encodeURIComponent(event.locationAddress)}`;
    } else {
      showToast('Location not available', 'warning');
      return;
    }

    Linking.openURL(url).catch(() => {
      showToast('Could not open maps', 'error');
    });
  }, [event]);

  const handleOpenVirtual = useCallback(() => {
    if (!event?.virtualLink) return;

    Linking.openURL(event.virtualLink).catch(() => {
      showToast('Could not open virtual meeting', 'error');
    });
  }, [event]);

  const handleAddToCalendar = useCallback(async () => {
    if (!event) return;

    try {
      const startDate = createEventDateTime(event.eventDate, event.startTime, event.timezone);
      const endDate = event.endTime
        ? createEventDateTime(event.eventDate, event.endTime, event.timezone)
        : calculateEndDate(startDate, undefined, 2);

      const result = await addEventToCalendar({
        title: event.title,
        startDate,
        endDate,
        location: event.isVirtual ? event.virtualLink || event.location : event.location,
        notes: event.description || undefined,
        timeZone: event.timezone,
      });

      if (result.success) {
        showToast('Added to calendar', 'success');
      } else {
        showToast(result.error || 'Failed to add to calendar', 'error');
      }
    } catch (error) {
      console.error('Error adding to calendar:', error);
      showToast('Failed to add to calendar', 'error');
    }
  }, [event]);

  // Contact handlers
  const handleCall = useCallback(() => {
    if (!event?.contactPhone) return;

    Linking.openURL(`tel:${event.contactPhone}`).catch(() => {
      showToast('Could not make call', 'error');
    });
  }, [event]);

  const handleEmail = useCallback(() => {
    if (!event?.contactEmail) return;

    Linking.openURL(`mailto:${event.contactEmail}`).catch(() => {
      showToast('Could not open email', 'error');
    });
  }, [event]);

  // Loading state with modern shimmer skeleton
  if (loading) {
    const heroHeight = responsive.isSmallMobile
      ? 280
      : responsive.isTablet || responsive.isDesktop
      ? 400
      : 320;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <EventHeader onBack={() => goBack('/(tabs)/discover')} onShare={() => {}} colors={colors} />
        <ScrollView style={styles.scrollView}>
          <ShimmerSkeleton
            colors={colors}
            style={{ width: '100%', height: heroHeight, borderRadius: 0 }}
          />

          <View style={{ padding: responsive.spacing.lg, gap: responsive.spacing.md }}>
            <ShimmerSkeleton
              colors={colors}
              style={{ width: 140, height: 32, borderRadius: 16 }}
            />

            <ShimmerSkeleton colors={colors} style={{ width: '85%', height: 34, borderRadius: 10 }} />
            <ShimmerSkeleton
              colors={colors}
              style={{
                width: '55%',
                height: 34,
                borderRadius: 10,
                marginBottom: responsive.spacing.md,
              }}
            />

            {[...Array(2)].map((_, i) => (
              <ShimmerSkeleton
                key={`info-${i}`}
                colors={colors}
                style={{ width: '100%', height: 96, borderRadius: 16 }}
              />
            ))}

            <View style={{ flexDirection: 'row', gap: responsive.spacing.md }}>
              {[...Array(3)].map((_, i) => (
                <ShimmerSkeleton
                  key={`stat-${i}`}
                  colors={colors}
                  style={{ flex: 1, height: 120, borderRadius: 16 }}
                />
              ))}
            </View>

            <ShimmerSkeleton colors={colors} style={{ width: 160, height: 24, borderRadius: 10 }} />
            {[...Array(4)].map((_, i) => (
              <ShimmerSkeleton
                key={`about-${i}`}
                colors={colors}
                style={{
                  width: i === 3 ? '75%' : '100%',
                  height: 18,
                  borderRadius: 8,
                }}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <EventHeader onBack={() => goBack('/(tabs)/discover')} onShare={() => {}} colors={colors} />
        <ErrorBoundary>
          <ErrorScreen onRetry={refetch} colors={colors} />
        </ErrorBoundary>
      </SafeAreaView>
    );
  }

  const spotsLeft = event.spotsRemaining ?? event.capacity ?? 999;
  const isSoldOut = spotsLeft <= 0;
  const isPastEvent = isEventPast(event.eventDate);

  const stats = [
    { key: 'registered', icon: Users, value: registrations.length || 0, label: 'Registered' },
    ...(event.capacity
      ? [
          {
            key: 'spots',
            icon: Ticket,
            value: Math.max(spotsLeft, 0),
            label: 'Spots Left',
          },
        ]
      : []),
    ...(!event.isFree && event.ticketPrice
      ? [
          {
            key: 'price',
            icon: DollarSign,
            value: formatCurrency(event.ticketPrice ?? 0),
            label: 'Price',
          },
        ]
      : []),
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <EventHeader onBack={() => goBack('/(tabs)/discover')} onShare={handleShare} colors={colors} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 120 + insets.bottom + webBottomPadding },
          ]}
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
          {/* Event Image */}
          <EventImage event={event} colors={colors} />

          {/* Content */}
          <View style={[styles.content, { backgroundColor: colors.surface }]}>
            {/* Registration Status */}
            <RegistrationStatusBanner registration={registration} colors={colors} />

            {/* Event Title */}
            <Text style={[styles.title, { color: colors.text }, Typography.title2]}>
              {event.title}
            </Text>

            {/* Date & Time Card */}
            <EventInfoCard
              icon={<Calendar size={24} color={colors.primary} />}
              title={formatEventDate(event.eventDate)}
              subtitle={`${formatEventTime(event.startTime)}${event.endTime ? ` - ${formatEventTime(event.endTime)}` : ''}`}
              badge={
                eventStatus === 'today' && (
                  <View style={[styles.todayBadge, { backgroundColor: colors.eventTodayRed }]}>
                    <Text style={[styles.todayBadgeText, { color: colors.textOnPrimary }]}>
                      TODAY
                    </Text>
                  </View>
                )
              }
              colors={colors}
            />

            {/* Location Card */}
            <EventInfoCard
              icon={
                event.isVirtual ? (
                  <Video size={24} color={colors.primary} />
                ) : (
                  <MapPin size={24} color={colors.primary} />
                )
              }
              title={event.isVirtual ? 'Virtual Event' : event.location}
              subtitle={event.isVirtual ? 'Join online from anywhere' : event.locationAddress}
              onPress={event.isVirtual ? handleOpenVirtual : handleOpenMap}
              colors={colors}
            />

            {/* Stats Row */}
            <View
              style={[
                styles.statsRow,
                responsive.isMobile && styles.statsRowStacked,
              ]}
            >
              {stats.map(({ key, icon: IconComponent, value, label }) => (
                <View
                  key={key}
                  style={[
                    styles.statCard,
                    { backgroundColor: colors.card },
                    getPremiumShadow(colors),
                    responsive.isMobile && styles.statCardStacked,
                  ]}
                >
                  <View style={[styles.statIcon, { backgroundColor: colors.primarySoft }]}>
                    <IconComponent size={20} color={colors.primary} />
                  </View>
                  <Text
                    style={[styles.statValue, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {value}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Description */}
            {event.description && (
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.card, padding: responsive.spacing.xl },
                  getPremiumShadow(colors),
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>About This Event</Text>
                <Text style={[styles.description, { color: colors.text }]}>{event.description}</Text>
              </View>
            )}

            {/* Contact Information */}
            {(event.contactEmail || event.contactPhone) && (
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.card, padding: responsive.spacing.xl },
                  getPremiumShadow(colors),
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
                <View style={styles.contactActions}>
                  {event.contactPhone && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.contactButton,
                        {
                          backgroundColor: colors.primarySoft,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleCall}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${event.contactPhone}`}
                    >
                      <Phone size={16} color={colors.primary} />
                      <Text style={[styles.contactButtonText, { color: colors.primary }]}>Call</Text>
                    </Pressable>
                  )}
                  {event.contactEmail && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.contactButton,
                        {
                          backgroundColor: colors.primarySoft,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleEmail}
                      accessibilityRole="button"
                      accessibilityLabel={`Email ${event.contactEmail}`}
                    >
                      <Mail size={16} color={colors.primary} />
                      <Text style={[styles.contactButtonText, { color: colors.primary }]}>Email</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Bottom spacing for fixed button */}
            <View
              style={[styles.bottomSpacing, { height: 120 + insets.bottom + webBottomPadding }]}
            />
          </View>
        </ScrollView>

        {/* Bottom Action Buttons */}
        {!isPastEvent && (
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: Spacing.xl + insets.bottom + webBottomPadding,
              },
            ]}
          >
            {/* Add to Calendar Button */}
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
                getPremiumShadow(colors),
              ]}
              onPress={handleAddToCalendar}
              accessibilityRole="button"
              accessibilityLabel="Add event to calendar"
            >
              <CalendarPlus size={20} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                Add to Calendar
              </Text>
            </Pressable>

            {/* Register Button */}
            <GradientButton
              variant={registration ? 'danger' : 'primary'}
              loading={registering}
              disabled={!registration && isSoldOut}
              onPress={handleRegister}
              icon={registration ? X : event.isFree ? Ticket : DollarSign}
              label={
                registering
                  ? 'Processing...'
                  : registration
                  ? 'Cancel Registration'
                  : isSoldOut
                  ? 'Sold Out'
                  : event.isFree
                  ? 'Register for Free'
                  : `Buy Tickets - ${event.ticketPrice ? formatCurrency(event.ticketPrice) : 'N/A'}`
              }
              colors={colors}
            />
          </View>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 1000,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 64,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    gap: 4,
  },
  featuredText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroMeta: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    marginTop: -24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  todayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statsRowStacked: {
    flexDirection: 'column',
  },
  statCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderRadius: 16,
  },
  statCardStacked: {
    flex: 0,
    width: '100%',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20, // Changed from 24
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderRadius: 16,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCopy: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 120, // Account for bottom bar (56px button + 40px padding + safe area)
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xl,
    borderTopWidth: 1,
  },
  actionButton: {
    width: '100%',
  },
  gradientButtonWrapper: {
    position: 'relative',
    width: '100%',
    marginBottom: 8,
  },
  gradientButtonPressable: {
    width: '100%',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.3)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 12px 24px rgba(15,23,42,0.2)',
      },
    }),
  },
  gradientButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonShadow: {
    position: 'absolute',
    bottom: -4,
    left: 12,
    right: 12,
    height: 12,
    borderRadius: 16,
    opacity: 0.3,
    zIndex: -1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  errorTitle: {
    ...Typography.title3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    ...Typography.body1,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  retryButton: {
    minWidth: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
