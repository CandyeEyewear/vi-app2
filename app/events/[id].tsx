/**
 * Event Detail Screen
 * Displays full event details with registration option
 * File: app/events/[id].tsx
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
  Linking,
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
import WebContainer from '../../components/WebContainer';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Category configuration
const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; emoji: string }> = {
  meetup: { label: 'Meetup', color: '#2196F3', emoji: '🤝' },
  gala: { label: 'Gala', color: '#9C27B0', emoji: '✨' },
  fundraiser: { label: 'Fundraiser', color: '#E91E63', emoji: '💝' },
  workshop: { label: 'Workshop', color: '#FF9800', emoji: '🛠️' },
  celebration: { label: 'Celebration', color: '#4CAF50', emoji: '🎉' },
  networking: { label: 'Networking', color: '#00BCD4', emoji: '🔗' },
  other: { label: 'Event', color: '#757575', emoji: '📅' },
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
        <View style={[styles.skeletonButton, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, isAdmin } = useAuth();

  // State
  const [event, setEvent] = useState<Event | null>(null);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Fetch event data
  const fetchEvent = useCallback(async () => {
    if (!id) return;

    try {
      const response = await getEventById(id);
      if (response.success && response.data) {
        setEvent(response.data);
      } else {
        Alert.alert('Error', 'Failed to load event details');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Something went wrong');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // Check user registration
  const checkRegistration = useCallback(async () => {
    if (!id || !user) return;

    try {
      const response = await checkUserRegistration(id, user.id);
      if (response.success) {
        setRegistration(response.data);
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  }, [id, user]);

  // Initial load
  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Check registration when user/event available
  useEffect(() => {
    if (user && event) {
      checkRegistration();
    }
  }, [user, event, checkRegistration]);

  // Load registrations for admin
  const fetchRegistrations = useCallback(async () => {
    if (!id || !isAdmin) return;

    try {
      setLoadingRegistrations(true);
      const response = await getEventRegistrations(id);
      if (response.success && response.data) {
        // Filter out cancelled registrations
        const activeRegistrations = response.data.filter(
          (reg) => reg.status !== 'cancelled'
        );
        setRegistrations(activeRegistrations);
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoadingRegistrations(false);
    }
  }, [id, isAdmin]);

  // Load registrations when admin views event
  useEffect(() => {
    if (isAdmin && event) {
      fetchRegistrations();
    }
  }, [isAdmin, event, fetchRegistrations]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchEvent(), checkRegistration()]);
    setRefreshing(false);
  }, [fetchEvent, checkRegistration]);

  // Share event
  const handleShare = useCallback(async () => {
    if (!event) return;

    try {
      const message = `Join me at "${event.title}"!\n\n📅 ${formatEventDate(event.eventDate)}\n⏰ ${formatEventTime(event.startTime)}\n📍 ${event.isVirtual ? 'Virtual Event' : event.location}\n\nRegister on Volunteers Inc!`;

      await Share.share({
        message,
        title: `Event: ${event.title}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [event]);

  // Handle registration
  const handleRegister = useCallback(async () => {
    if (!event || !id) return;

    if (!user) {
      Alert.alert(
        'Sign In Required',
        'You need to be signed in to register for events',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    // If already registered, allow cancellation
    if (registration) {
      Alert.alert(
        'Cancel Registration?',
        'Are you sure you want to cancel your registration for this event?',
        [
          { text: 'Keep Registration', style: 'cancel' },
          {
            text: 'Cancel Registration',
            style: 'destructive',
            onPress: async () => {
              setRegistering(true);
              const response = await cancelEventRegistration(registration.id);
              if (response.success) {
                setRegistration(null);
                Alert.alert('Cancelled', 'Your registration has been cancelled');
                fetchEvent(); // Refresh to update spots
              } else {
                Alert.alert('Error', response.error || 'Failed to cancel registration');
              }
              setRegistering(false);
            },
          },
        ]
      );
      return;
    }

    // For paid events, navigate to registration screen
    if (!event.isFree) {
      router.push(`/events/${id}/register`);
      return;
    }

    // Free event - register directly
    setRegistering(true);
    const response = await registerForEvent({
      eventId: id,
      userId: user.id,
    });

    if (response.success && response.data) {
      setRegistration(response.data);
      Alert.alert('Registered! 🎉', 'You are now registered for this event');
      fetchEvent(); // Refresh to update spots
    } else {
      Alert.alert('Error', response.error || 'Failed to register');
    }
    setRegistering(false);
  }, [event, id, user, registration, router, fetchEvent]);

  // Open map
  const handleOpenMap = useCallback(() => {
    if (!event) return;

    if (event.mapLink) {
      Linking.openURL(event.mapLink);
    } else if (event.latitude && event.longitude) {
      const url = `https://maps.google.com/?q=${event.latitude},${event.longitude}`;
      Linking.openURL(url);
    } else if (event.locationAddress) {
      const url = `https://maps.google.com/?q=${encodeURIComponent(event.locationAddress)}`;
      Linking.openURL(url);
    }
  }, [event]);

  // Open virtual link
  const handleOpenVirtual = useCallback(() => {
    if (event?.virtualLink) {
      Linking.openURL(event.virtualLink);
    }
  }, [event]);

  // Contact handlers
  const handleCall = useCallback(() => {
    if (event?.contactPhone) {
      Linking.openURL(`tel:${event.contactPhone}`);
    }
  }, [event]);

  const handleEmail = useCallback(() => {
    if (event?.contactEmail) {
      Linking.openURL(`mailto:${event.contactEmail}`);
    }
  }, [event]);

  // Loading state
  if (loading || !event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
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

  const categoryConfig = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const daysUntil = getDaysUntilEvent(event.eventDate);
  const isToday = isEventToday(event.eventDate);
  const isPast = isEventPast(event.eventDate);
  const spotsLeft = event.spotsRemaining ?? event.capacity;
  const isSoldOut = spotsLeft === 0;
  const isRegistered = !!registration;

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

      <WebContainer>
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
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: categoryConfig.color }]}>
              <Text style={styles.placeholderEmoji}>{categoryConfig.emoji}</Text>
            </View>
          )}

          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
            <Text style={styles.categoryBadgeText}>
              {categoryConfig.emoji} {categoryConfig.label}
            </Text>
          </View>

          {/* Featured Badge */}
          {event.isFeatured && (
            <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
              <Star size={14} color="#000" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {event.title}
          </Text>

          {/* Date & Time Card */}
          <View style={[styles.dateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.dateIconContainer, { backgroundColor: '#38B6FF' }]}>
              <Calendar size={24} color="#FFFFFF" />
            </View>
            <View style={styles.dateInfo}>
              <View style={styles.dateRow}>
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatEventDate(event.eventDate)}
                </Text>
                {isToday && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>TODAY</Text>
                  </View>
                )}
                {isPast && (
                  <View style={[styles.todayBadge, { backgroundColor: '#757575' }]}>
                    <Text style={styles.todayBadgeText}>PAST</Text>
                  </View>
                )}
              </View>
              <View style={styles.timeRow}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                  {formatEventTime(event.startTime)}
                  {event.endTime && ` - ${formatEventTime(event.endTime)}`}
                </Text>
              </View>
              {!isPast && daysUntil > 0 && (
                <Text style={[styles.daysUntilText, { color: '#38B6FF' }]}>
                  {daysUntil} {daysUntil === 1 ? 'day' : 'days'} from now
                </Text>
              )}
            </View>
          </View>

          {/* Location Card */}
          <TouchableOpacity
            style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={event.isVirtual ? handleOpenVirtual : handleOpenMap}
            disabled={event.isVirtual ? !event.virtualLink : !event.mapLink && !event.locationAddress}
          >
            <View style={[styles.locationIconContainer, { backgroundColor: event.isVirtual ? '#38B6FF' : '#4CAF50' }]}>
              {event.isVirtual ? (
                <Video size={24} color="#FFFFFF" />
              ) : (
                <MapPin size={24} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.locationInfo}>
              <Text style={[styles.locationTitle, { color: colors.text }]}>
                {event.isVirtual ? 'Virtual Event' : event.location}
              </Text>
              {event.isVirtual ? (
                event.virtualLink && (
                  <Text style={[styles.locationSubtitle, { color: '#38B6FF' }]}>
                    Join online
                  </Text>
                )
              ) : (
                event.locationAddress && (
                  <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                    {event.locationAddress}
                  </Text>
                )
              )}
            </View>
            {((event.isVirtual && event.virtualLink) || (!event.isVirtual && (event.mapLink || event.locationAddress))) && (
              <ExternalLink size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Price & Capacity */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <DollarSign size={20} color={event.isFree ? '#4CAF50' : '#38B6FF'} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {event.isFree ? 'FREE' : formatCurrency(event.ticketPrice || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {event.isFree ? 'Entry' : 'per ticket'}
              </Text>
            </View>

            {event.capacity && (
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Users size={20} color={isSoldOut ? '#F44336' : '#38B6FF'} />
                <Text style={[styles.statValue, { color: isSoldOut ? '#F44336' : colors.text }]}>
                  {isSoldOut ? 'Sold Out' : spotsLeft}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {isSoldOut ? '' : 'spots left'}
                </Text>
              </View>
            )}
          </View>

          {/* Registration Status */}
          {isRegistered && (
            <View style={[styles.registeredBanner, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <Check size={20} color="#4CAF50" />
              <Text style={styles.registeredText}>You're registered for this event!</Text>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              About this Event
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {event.description}
            </Text>
          </View>

          {/* Linked Cause */}
          {event.cause && (
            <TouchableOpacity
              style={[styles.causeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/causes/${event.causeId}`)}
            >
              <Heart size={20} color="#E91E63" />
              <View style={styles.causeInfo}>
                <Text style={[styles.causeLabel, { color: colors.textSecondary }]}>
                  Supporting
                </Text>
                <Text style={[styles.causeName, { color: colors.text }]}>
                  {event.cause.title}
                </Text>
              </View>
              <ExternalLink size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Contact Info */}
          {(event.contactName || event.contactEmail || event.contactPhone) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Contact
              </Text>
              <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {event.contactName && (
                  <Text style={[styles.contactName, { color: colors.text }]}>
                    {event.contactName}
                  </Text>
                )}
                <View style={styles.contactActions}>
                  {event.contactPhone && (
                    <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                      <Phone size={18} color="#38B6FF" />
                      <Text style={[styles.contactButtonText, { color: '#38B6FF' }]}>Call</Text>
                    </TouchableOpacity>
                  )}
                  {event.contactEmail && (
                    <TouchableOpacity style={styles.contactButton} onPress={handleEmail}>
                      <Mail size={18} color="#38B6FF" />
                      <Text style={[styles.contactButtonText, { color: '#38B6FF' }]}>Email</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Admin: Event Registrations */}
          {isAdmin && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Registrations
                </Text>
                <Text style={[styles.registrationCount, { color: colors.textSecondary }]}>
                  {registrations.length} {registrations.length === 1 ? 'person' : 'people'}
                </Text>
              </View>
              {loadingRegistrations ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#38B6FF" />
                </View>
              ) : registrations.length === 0 ? (
                <View style={[styles.emptyRegistrations, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Users size={24} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No registrations yet
                  </Text>
                </View>
              ) : (
                <View style={styles.registrationsList}>
                  {registrations.map((reg) => (
                    <View
                      key={reg.id}
                      style={[styles.registrationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.registrationInfo}>
                        <Text style={[styles.registrationName, { color: colors.text }]}>
                          {reg.user?.fullName || 'Unknown User'}
                        </Text>
                        {reg.user?.email && (
                          <Text style={[styles.registrationEmail, { color: colors.textSecondary }]}>
                            {reg.user.email}
                          </Text>
                        )}
                        {reg.user?.phone && (
                          <Text style={[styles.registrationPhone, { color: colors.textSecondary }]}>
                            {reg.user.phone}
                          </Text>
                        )}
                        <View style={styles.registrationMeta}>
                          <Text style={[styles.registrationMetaText, { color: colors.textSecondary }]}>
                            {reg.ticketCount || 1} {reg.ticketCount === 1 ? 'ticket' : 'tickets'}
                          </Text>
                          <Text style={[styles.registrationMetaText, { color: colors.textSecondary }]}>
                            • Registered {new Date(reg.registeredAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        {
                          backgroundColor: reg.status === 'registered' ? '#E8F5E9' : reg.status === 'cancelled' ? '#FFEBEE' : '#FFF3E0',
                        }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          {
                            color: reg.status === 'registered' ? '#4CAF50' : reg.status === 'cancelled' ? '#F44336' : '#FF9800',
                          }
                        ]}>
                          {reg.status === 'registered' ? 'Registered' : reg.status === 'cancelled' ? 'Cancelled' : reg.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>
      </WebContainer>

      {/* Fixed Bottom Button */}
      {!isPast && (
        <View style={[styles.bottomBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
          {isRegistered ? (
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: '#F44336' }]}
              onPress={handleRegister}
              disabled={registering}
              activeOpacity={0.8}
            >
              {registering ? (
                <ActivityIndicator size="small" color="#F44336" />
              ) : (
                <>
                  <X size={22} color="#F44336" />
                  <Text style={[styles.cancelButtonText, { color: '#F44336' }]}>
                    Cancel Registration
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : isSoldOut ? (
            <View style={[styles.soldOutButton, { backgroundColor: colors.border }]}>
              <Text style={[styles.soldOutButtonText, { color: colors.textSecondary }]}>
                Sold Out
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: '#38B6FF' }]}
              onPress={handleRegister}
              disabled={registering}
              activeOpacity={0.8}
            >
              {registering ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ticket size={22} color="#FFFFFF" />
                  <Text style={styles.registerButtonText}>
                    {event.isFree ? 'Register Now' : `Get Tickets · ${formatCurrency(event.ticketPrice || 0)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
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
    height: 260,
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
  placeholderEmoji: {
    fontSize: 72,
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
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 16,
  },
  dateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateInfo: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timeText: {
    fontSize: 14,
  },
  daysUntilText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  registeredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  registeredText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  causeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  causeInfo: {
    flex: 1,
  },
  causeLabel: {
    fontSize: 12,
  },
  causeName: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  contactCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  soldOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  soldOutButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  registrationCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyRegistrations: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  registrationsList: {
    gap: 12,
  },
  registrationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  registrationInfo: {
    flex: 1,
  },
  registrationName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  registrationEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  registrationPhone: {
    fontSize: 14,
    marginBottom: 8,
  },
  registrationMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  registrationMetaText: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Skeleton
  skeletonContainer: {
    flex: 1,
  },
  skeletonImage: {
    height: 260,
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
  skeletonButton: {
    height: 52,
    borderRadius: 12,
    width: '100%',
    marginTop: 16,
  },
});
