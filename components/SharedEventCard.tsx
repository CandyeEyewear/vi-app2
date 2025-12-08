/**
 * Shared Event Card Component
 * Displays an event card when someone shares it to the feed
 * Clicking on it navigates to the event details page
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Calendar, Clock, MapPin, Users, Video, Ticket, Star, ExternalLink } from 'lucide-react-native';
import { Event, EventCategory } from '../types';
import { Colors } from '../constants/colors';
import { EVENT_CATEGORY_CONFIG } from '../constants/eventCategories';
import { useRouter } from 'expo-router';
import {
  formatEventDate,
  formatEventTime,
  getDaysUntilEvent,
  isEventToday,
  formatCurrency,
  isEventPast,
} from '../services/eventsService';
import { AnimatedPressable } from './AnimatedPressable';
import { useAuth } from '../contexts/AuthContext';

interface SharedEventCardProps {
  event: Event;
}

export default function SharedEventCard({ event }: SharedEventCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const imageLoadingRef = React.useRef(true);

  const categoryConfig = EVENT_CATEGORY_CONFIG[event.category] || EVENT_CATEGORY_CONFIG.other;
  const daysUntil = event.eventDate ? getDaysUntilEvent(event.eventDate) : null;
  const isToday = event.eventDate ? isEventToday(event.eventDate) : false;
  const isPast = event.eventDate ? isEventPast(event.eventDate) : false;
  const spotsLeft = event.spotsRemaining ?? event.capacity;
  const hasLimitedSpots = spotsLeft !== undefined && spotsLeft <= 10 && spotsLeft > 0;

  // Memoize image source to prevent recreation
  const imageSource = React.useMemo(() => {
    return event.imageUrl ? { uri: event.imageUrl } : null;
  }, [event.imageUrl]);

  const handlePress = () => {
    // Validate slug exists and is not empty
    if (!event.slug || event.slug.trim() === '') {
      console.error('Event slug is missing or empty:', event);
      // Fallback to using ID if slug is missing
      if (event.id) {
        router.push({
          pathname: '/events/[slug]',
          params: { slug: event.id }
        } as any);
      } else {
        console.error('Event ID is also missing, cannot navigate');
      }
      return;
    }

    // Check if event has passed and user is not admin
    if (isPast && !isAdmin) {
      Alert.alert(
        'Event No Longer Available',
        'This event has passed its date and is no longer available for viewing.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Use object format with pathname and params for dynamic routes - more reliable than string paths
    router.push({
      pathname: '/events/[slug]',
      params: { slug: event.slug }
    } as any);
  };

  // Memoize callbacks to prevent recreation
  const handleLoadStart = React.useCallback(() => {
    imageLoadingRef.current = true;
  }, []);

  const handleLoadEnd = React.useCallback(() => {
    imageLoadingRef.current = false;
    setShowLoader(false);
  }, []);

  const handleImageError = React.useCallback(() => {
    setImageError(true);
    setShowLoader(false);
  }, []);

  // Cleaner image rendering logic
  const renderEventImage = () => {
    // No image URL provided
    if (!imageSource) {
      return null;
    }

    // Image failed to load - show placeholder
    if (imageError) {
      return (
        <View style={[styles.imagePlaceholder, { backgroundColor: categoryConfig.color }]}>
          <Text style={styles.placeholderEmoji}>{categoryConfig.emoji}</Text>
        </View>
      );
    }

    // Show image with loading state
    return (
      <View style={styles.imageContainer}>
        <Image 
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleImageError}
        />
        {showLoader && (
          <View style={[styles.imageLoadingOverlay, { backgroundColor: colors.imageOverlayLight }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>
    );
  };

  return (
    <AnimatedPressable
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
    >
      {renderEventImage()}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
            <Text style={styles.categoryBadgeText}>
              {categoryConfig.emoji} {categoryConfig.label}
            </Text>
          </View>
          {event.isFeatured && (
            <View style={[styles.featuredBadge, { backgroundColor: colors.eventFeaturedGold }]}>
              <Star size={12} color="#000" fill="#000" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Date & Time */}
        <View style={styles.infoRow}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {event.eventDate ? formatEventDate(event.eventDate) : 'Date TBA'}
          </Text>
          {isToday && (
            <View style={[styles.todayBadge, { backgroundColor: colors.eventTodayRed }]}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>

        <View style={styles.infoRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {event.startTime ? formatEventTime(event.startTime) : 'TBA'}
            {event.endTime && event.startTime && ` - ${formatEventTime(event.endTime)}`}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.infoRow}>
          {event.isVirtual ? (
            <>
              <Video size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>
                Virtual Event
              </Text>
            </>
          ) : (
            <>
              <MapPin size={14} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {event.location}
              </Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.statsRow}>
            {event.isFree ? (
              <Text style={[styles.freeText, { color: colors.success }]}>FREE</Text>
            ) : (
              <Text style={[styles.priceText, { color: colors.text }]}>
                {formatCurrency(event.ticketPrice || 0)}
              </Text>
            )}
            {event.capacity && (
              <View style={styles.spotsContainer}>
                <Users size={14} color={hasLimitedSpots ? colors.warning : colors.textSecondary} />
                <Text
                  style={[
                    styles.spotsText,
                    { color: hasLimitedSpots ? colors.warning : colors.textSecondary },
                  ]}
                >
                  {spotsLeft === 0
                    ? 'Sold out'
                    : hasLimitedSpots
                    ? `${spotsLeft} spots left!`
                    : `${spotsLeft} spots`}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.linkContainer}>
            <Text style={[styles.linkText, { color: colors.primary }]}>View Event</Text>
            <ExternalLink size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadge: {
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  todayBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  freeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

