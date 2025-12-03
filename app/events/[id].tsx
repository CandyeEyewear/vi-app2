/**
 * Optimized Event Detail Screen
 * Modern design with professional UI/UX, performance optimizations, and accessibility
 * File: app/events/[id].tsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Share2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  Ticket,
  Star,
  ExternalLink,
  Phone,
  Mail,
  DollarSign,
  Heart,
  Check,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { Event, EventCategory, EventRegistration } from '../../types';
import {
  getEventById,
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
import ErrorBoundary from '../../components/ErrorBoundary';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { ShimmerSkeleton } from '../../components/ShimmerSkeleton';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

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

// Category configuration with modern colors
const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; emoji: string }> = {
  meetup: { label: 'Meetup', color: '#2196F3', emoji: '🤝' },
  gala: { label: 'Gala', color: '#9C27B0', emoji: '✨' },
  fundraiser: { label: 'Fundraiser', color: '#E91E63', emoji: '💝' },
  workshop: { label: 'Workshop', color: '#FF9800', emoji: '🛠️' },
  celebration: { label: 'Celebration', color: '#4CAF50', emoji: '🎉' },
  networking: { label: 'Networking', color: '#00BCD4', emoji: '🔗' },
  other: { label: 'Event', color: '#757575', emoji: '📅' },
};

// Custom Hook for Event Data
function useEventDetails(eventId: string | undefined) {
  const [event, setEvent] = useState<Event | null>(null);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();

  const fetchEventData = useCallback(async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      const [eventResponse, registrationResponse] = await Promise.all([
        getEventById(eventId),
        user ? checkUserRegistration(eventId, user.id) : Promise.resolve({ success: true, data: null }),
      ]);

      if (eventResponse.success && eventResponse.data) {
        setEvent(eventResponse.data);
      } else {
        throw new Error('Failed to load event details');
      }

      if (registrationResponse.success) {
        setRegistration(registrationResponse.data);
      }

      // Load registrations for admin
      if (isAdmin && eventResponse.data) {
        const registrationsResponse = await getEventRegistrations(eventId);
        if (registrationsResponse.success && registrationsResponse.data) {
          const activeRegistrations = registrationsResponse.data.filter(
            (reg) => reg.status !== 'cancelled'
          );
          setRegistrations(activeRegistrations);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [eventId, user, isAdmin]);

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

// Modern Header Component
function EventHeader({ 
  onBack, 
  onShare, 
  colors 
}: { 
  onBack: () => void; 
  onShare: () => void; 
  colors: any;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.header, 
      { 
        paddingTop: insets.top + Spacing.lg,
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      }
    ]}>
      <TouchableOpacity
        style={[styles.headerButton, { backgroundColor: colors.card }]}
        onPress={() => {
          // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBack();
        }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to previous screen"
      >
        <ArrowLeft size={24} color={colors.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.headerButton, { backgroundColor: colors.card }]}
        onPress={() => {
          // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onShare();
        }}
        accessibilityRole="button"
        accessibilityLabel="Share event"
        accessibilityHint="Opens share options for this event"
      >
        <Share2 size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

// Event Image Component with modern loading
function EventImage({ 
  event, 
  colors 
}: { 
  event: Event; 
  colors: any;
}) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const categoryConfig = CATEGORY_CONFIG[event.category];

  return (
    <View style={styles.imageContainer}>
      {event.imageUrl && !imageError ? (
        <>
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.eventImage}
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
            resizeMode="cover"
            accessibilityLabel={`Event image for ${event.title}`}
          />
          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color="#38B6FF" />
            </View>
          )}
        </>
      ) : (
        <View style={[styles.placeholderImage, { backgroundColor: categoryConfig.color }]}>
          <Text style={styles.placeholderEmoji}>
            {categoryConfig.emoji}
          </Text>
        </View>
      )}
      
      {/* Category Badge */}
      <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
        <Text style={styles.categoryBadgeText}>
          {categoryConfig.emoji} {categoryConfig.label}
        </Text>
      </View>
    </View>
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
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Card style={styles.infoCard}>
      <Component
        style={styles.infoCardContent}
        onPress={onPress ? () => {
          // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        } : undefined}
        accessibilityRole={onPress ? "button" : undefined}
      >
        <View style={[styles.infoIcon, { backgroundColor: colors.cardSecondary }]}>
          {icon}
        </View>
        <View style={styles.infoContent}>
          <View style={styles.infoTitleRow}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              {title}
            </Text>
            {badge}
          </View>
          {subtitle && (
            <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {onPress && (
          <ExternalLink size={20} color={colors.textSecondary} />
        )}
      </Component>
    </Card>
  );
}

// Registration Status Banner
function RegistrationStatusBanner({
  registration,
  event,
  colors,
}: {
  registration: EventRegistration | null;
  event: Event;
  colors: any;
}) {
  if (!registration) return null;

  return (
    <Card style={[styles.statusBanner, { backgroundColor: '#E8F5E8' }]}>
      <View style={styles.statusContent}>
        <Check size={20} color="#4CAF50" />
        <Text style={[styles.statusText, { color: '#2E7D32' }]}>
          You're registered for this event
        </Text>
      </View>
    </Card>
  );
}

// Error Component
function ErrorScreen({ 
  onRetry, 
  colors 
}: { 
  onRetry: () => void; 
  colors: any;
}) {
  return (
    <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
      <AlertCircle size={48} color={colors.textSecondary} />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
        We couldn't load the event details. Please try again.
      </Text>
      <Button
        variant="primary"
        onPress={onRetry}
        style={styles.retryButton}
      >
        Try Again
      </Button>
    </View>
  );
}

// Main Component
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  const {
    event,
    registration,
    registrations,
    loading,
    error,
    refetch,
  } = useEventDetails(id);

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

  // Event handlers with haptic feedback
  const handleShare = useCallback(async () => {
    if (!event) return;

    try {
      // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const message = `Join me at "${event.title}"!\n\n📅 ${formatEventDate(event.eventDate)}\n⏰ ${formatEventTime(event.startTime)}\n📍 ${event.isVirtual ? 'Virtual Event' : event.location}\n\nRegister on Volunteers Inc!`;

      await Share.share({
        message,
        title: `Event: ${event.title}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      showToast('Could not share event', 'error');
    }
  }, [event]);

  const handleRegister = useCallback(async () => {
    if (!event || !id) return;

    if (!user) {
      showToast('Please sign in to register for events', 'warning');
      router.push('/login');
      return;
    }

    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If already registered, handle cancellation
    if (registration) {
      // Show confirmation (you'd implement a proper modal here)
      const confirmed = Platform.OS === 'web' 
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
      router.push(`/events/${id}/register`);
      return;
    }

    // Free event - register directly
    setRegistering(true);
    try {
      const response = await registerForEvent({
        eventId: id,
        userId: user.id,
      });

      if (response.success && response.data) {
        // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Successfully registered! 🎉', 'success');
        refetch();
      } else {
        // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast(response.error || 'Failed to register', 'error');
      }
    } catch (error) {
      // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Something went wrong', 'error');
    } finally {
      setRegistering(false);
    }
  }, [event, id, user, registration, router, refetch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Location handlers
  const handleOpenMap = useCallback(() => {
    if (!event) return;
    
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
    
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Linking.openURL(event.virtualLink).catch(() => {
      showToast('Could not open virtual meeting', 'error');
    });
  }, [event]);

  // Contact handlers
  const handleCall = useCallback(() => {
    if (!event?.contactPhone) return;
    
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Linking.openURL(`tel:${event.contactPhone}`).catch(() => {
      showToast('Could not make call', 'error');
    });
  }, [event]);

  const handleEmail = useCallback(() => {
    if (!event?.contactEmail) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Linking.openURL(`mailto:${event.contactEmail}`).catch(() => {
      showToast('Could not open email', 'error');
    });
  }, [event]);

  // Loading state with modern shimmer skeleton
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <EventHeader 
          onBack={() => router.back()} 
          onShare={() => {}} 
          colors={colors} 
        />
        <ScrollView style={styles.scrollView}>
          {/* Image Skeleton */}
          <ShimmerSkeleton 
            colors={colors} 
            style={{ width: '100%', height: 300, borderRadius: 0 }} 
          />
          
          <View style={{ padding: Spacing.lg }}>
            {/* Category Badge Skeleton */}
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: 100, height: 28, borderRadius: 14, marginBottom: Spacing.md }} 
            />
            
            {/* Title Skeleton */}
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: '90%', height: 32, borderRadius: 8, marginBottom: Spacing.sm }} 
            />
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: '70%', height: 32, borderRadius: 8, marginBottom: Spacing.xxl }} 
            />
            
            {/* Info Cards Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl }}>
              {[...Array(4)].map((_, i) => (
                <ShimmerSkeleton 
                  key={i}
                  colors={colors} 
                  style={{ 
                    width: screenWidth > 600 ? '23%' : '48%', 
                    height: 100, 
                    borderRadius: 12 
                  }} 
                />
              ))}
            </View>
            
            {/* Description Section */}
            <ShimmerSkeleton 
              colors={colors} 
              style={{ width: 120, height: 24, borderRadius: 8, marginBottom: Spacing.md }} 
            />
            {[...Array(6)].map((_, i) => (
              <ShimmerSkeleton 
                key={`desc-${i}`}
                colors={colors} 
                style={{ 
                  width: i === 5 ? '70%' : '100%', 
                  height: 16, 
                  borderRadius: 8, 
                  marginBottom: Spacing.sm 
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
        <EventHeader 
          onBack={() => router.back()} 
          onShare={() => {}} 
          colors={colors} 
        />
        <ErrorBoundary>
          <ErrorScreen onRetry={refetch} colors={colors} />
        </ErrorBoundary>
      </SafeAreaView>
    );
  }

  const spotsLeft = event.spotsRemaining ?? event.capacity ?? 999;
  const isSoldOut = spotsLeft <= 0;
  const isPastEvent = isEventPast(event.eventDate);

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <EventHeader onBack={() => router.back()} onShare={handleShare} colors={colors} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#38B6FF"
              colors={["#38B6FF"]}
            />
          }
        >
          {/* Event Image */}
          <EventImage event={event} colors={colors} />

          {/* Content */}
          <View style={[styles.content, { backgroundColor: colors.background }]}>
            
            {/* Registration Status */}
            <RegistrationStatusBanner 
              registration={registration} 
              event={event} 
              colors={colors} 
            />

            {/* Event Title */}
            <Text style={[styles.title, { color: colors.text }, Typography.title2]}>
              {event.title}
            </Text>

            {/* Date & Time Card */}
            <EventInfoCard
              icon={<Calendar size={24} color="#38B6FF" />}
              title={formatEventDate(event.eventDate)}
              subtitle={`${formatEventTime(event.startTime)}${event.endTime ? ` - ${formatEventTime(event.endTime)}` : ''}`}
              badge={eventStatus === 'today' && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
              colors={colors}
            />

            {/* Location Card */}
            <EventInfoCard
              icon={event.isVirtual ? 
                <Video size={24} color="#38B6FF" /> : 
                <MapPin size={24} color="#38B6FF" />
              }
              title={event.isVirtual ? 'Virtual Event' : event.location}
              subtitle={event.isVirtual ? 
                'Join online from anywhere' : 
                event.locationAddress
              }
              onPress={event.isVirtual ? handleOpenVirtual : handleOpenMap}
              colors={colors}
            />

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Users size={20} color="#38B6FF" />
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {registrations.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Registered
                </Text>
              </Card>

              {event.capacity && (
                <Card style={styles.statCard}>
                  <Ticket size={20} color="#38B6FF" />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {spotsLeft}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Spots Left
                  </Text>
                </Card>
              )}

              {!event.isFree && (
                <Card style={styles.statCard}>
                  <DollarSign size={20} color="#38B6FF" />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(event.ticketPrice)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Price
                  </Text>
                </Card>
              )}
            </View>

            {/* Description */}
            {event.description && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  About This Event
                </Text>
                <Text style={[styles.description, { color: colors.text }, Typography.body1]}>
                  {event.description}
                </Text>
              </Card>
            )}

            {/* Contact Information */}
            {(event.contactEmail || event.contactPhone) && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Contact
                </Text>
                <View style={styles.contactActions}>
                  {event.contactPhone && (
                    <TouchableOpacity 
                      style={styles.contactButton}
                      onPress={handleCall}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${event.contactPhone}`}
                    >
                      <Phone size={16} color="#38B6FF" />
                      <Text style={[styles.contactButtonText, { color: '#38B6FF' }]}>
                        Call
                      </Text>
                    </TouchableOpacity>
                  )}
                  {event.contactEmail && (
                    <TouchableOpacity 
                      style={styles.contactButton}
                      onPress={handleEmail}
                      accessibilityRole="button"
                      accessibilityLabel={`Email ${event.contactEmail}`}
                    >
                      <Mail size={16} color="#38B6FF" />
                      <Text style={[styles.contactButtonText, { color: '#38B6FF' }]}>
                        Email
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            )}

            {/* Bottom spacing for fixed button */}
            <View style={styles.bottomSpacing} />
          </View>
        </ScrollView>

        {/* Bottom Action Button */}
        {!isPastEvent && (
          <View style={[
            styles.bottomBar, 
            { 
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            }
          ]}>
            <Button
              variant={registration ? "outline" : "primary"}
              size="lg"
              loading={registering}
              disabled={!registration && isSoldOut}
              onPress={handleRegister}
              style={styles.actionButton}
              icon={registration ? 
                <X size={20} color="#FF5722" /> : 
                event.isFree ? <Ticket size={20} color="#FFFFFF" /> : <DollarSign size={20} color="#FFFFFF" />
              }
            >
              {registering ? 'Processing...' :
               registration ? 'Cancel Registration' :
               isSoldOut ? 'Sold Out' :
               event.isFree ? 'Register for Free' : `Buy Tickets - ${formatCurrency(event.ticketPrice)}`}
            </Button>
          </View>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

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
    paddingBottom: 100, // Space for bottom button
  },
  imageContainer: {
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: 300,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  placeholderImage: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 64,
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    ...Typography.title2,
    marginBottom: Spacing.xl,
    lineHeight: 32,
  },
  infoCard: {
    marginBottom: Spacing.md,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
    ...Typography.body1,
    fontWeight: '600',
  },
  infoSubtitle: {
    ...Typography.body2,
    marginTop: 2,
  },
  todayBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.caption,
  },
  statusBanner: {
    marginBottom: Spacing.lg,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body1,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  actionButton: {
    width: '100%',
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
