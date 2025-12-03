/**
 * EventCard Component
 * Displays a single event in a card format
 * File: components/cards/EventCard.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  useColorScheme,
  Dimensions,
} from 'react-native';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  Ticket,
  Star,
  Share2,
  Bookmark,
} from 'lucide-react-native';
import { Event, EventCategory } from '../../types';
import { Colors } from '../../constants/colors';
import {
  formatEventDate,
  formatEventTime,
  getDaysUntilEvent,
  isEventToday,
  formatCurrency,
} from '../../services/eventsService';
import { useFeed } from '../../contexts/FeedContext';
import ShareEventModal from '../ShareEventModal';
import { showToast } from '../../utils/toast';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

interface EventCardProps {
  event: Event;
  onPress?: () => void;
  onRegisterPress?: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

// Category colors and labels
const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; emoji: string }> = {
  meetup: { label: 'Meetup', color: '#2196F3', emoji: '🤝' },
  gala: { label: 'Gala', color: '#9C27B0', emoji: '✨' },
  fundraiser: { label: 'Fundraiser', color: '#E91E63', emoji: '💝' },
  workshop: { label: 'Workshop', color: '#FF9800', emoji: '🛠️' },
  celebration: { label: 'Celebration', color: '#4CAF50', emoji: '🎉' },
  networking: { label: 'Networking', color: '#00BCD4', emoji: '🔗' },
  other: { label: 'Event', color: '#757575', emoji: '📅' },
};

export function EventCard({ event, onPress, onRegisterPress, isSaved = false, onToggleSave }: EventCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { shareEventToFeed } = useFeed();

  const categoryConfig = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const daysUntil = event.eventDate ? getDaysUntilEvent(event.eventDate) : null;
  const isToday = event.eventDate ? isEventToday(event.eventDate) : false;
  const spotsLeft = event.spotsRemaining ?? event.capacity;
  const hasLimitedSpots = spotsLeft !== undefined && spotsLeft <= 10 && spotsLeft > 0;

  const handleRegisterPress = (e: any) => {
    e.stopPropagation();
    onRegisterPress?.();
  };

  const handleSharePress = (e: any) => {
    e.stopPropagation();
    setShowShareModal(true);
  };

  const handleSavePress = (e: any) => {
    e.stopPropagation();
    onToggleSave?.();
  };

  const handleShare = async (comment?: string, visibility: 'public' | 'circle' = 'public') => {
    try {
      setSharing(true);
      const response = await shareEventToFeed(event.id, comment, visibility);

      if (response.success) {
        showToast(`Shared to ${visibility === 'circle' ? 'Circle' : 'Feed'}! 🎉`, 'success');
        setShowShareModal(false);
      } else {
        showToast(response.error || 'Failed to share event', 'error');
      }
    } catch (error) {
      showToast('Something went wrong while sharing', 'error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}. ${event.eventDate ? formatEventDate(event.eventDate) : 'Date TBA'}`}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
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

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Bookmark Button */}
          {onToggleSave && (
            <Pressable
              onPress={handleSavePress}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Bookmark 
                size={18} 
                color="#FFFFFF" 
                fill={isSaved ? "#FFFFFF" : "none"}
              />
            </Pressable>
          )}
          
          {/* Share Button */}
          <Pressable
            onPress={handleSharePress}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Share2 size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Featured Badge */}
        {event.isFeatured && (
          <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
            <Star size={12} color="#000" />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
        )}

        {/* Date Badge */}
        {event.eventDate && (
          <View style={[styles.dateBadge, { backgroundColor: colors.card }]}>
            <Text style={[styles.dateMonth, { color: colors.primary }]}>
              {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </Text>
            <Text style={[styles.dateDay, { color: colors.text }]}>
              {new Date(event.eventDate).getDate()}
            </Text>
          </View>
        )}
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        {/* Title */}
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
            <View style={styles.todayBadge}>
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
                {event.location || 'Location TBA'}
              </Text>
            </>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Price */}
          <View style={styles.priceContainer}>
            {event.isFree ? (
              <Text style={[styles.freeText, { color: '#4CAF50' }]}>FREE</Text>
            ) : (
              <Text style={[styles.priceText, { color: colors.text }]}>
                {formatCurrency(event.ticketPrice || 0)}
              </Text>
            )}
          </View>

          {/* Spots Remaining */}
          {event.capacity && (
            <View style={styles.spotsContainer}>
              <Users size={14} color={hasLimitedSpots ? '#FF9800' : colors.textSecondary} />
              <Text
                style={[
                  styles.spotsText,
                  { color: hasLimitedSpots ? '#FF9800' : colors.textSecondary },
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

        {/* Register Button */}
        {event.registrationRequired && spotsLeft !== 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
            onPress={handleRegisterPress}
            accessibilityRole="button"
            accessibilityLabel={`Register for ${event.title}`}
          >
            <Ticket size={16} color="#FFFFFF" />
            <Text style={styles.registerButtonText}>
              {event.isFree ? 'Register Now' : 'Get Tickets'}
            </Text>
          </Pressable>
        )}

        {/* View Details (if no registration required) */}
        {!event.registrationRequired && (
          <View style={[styles.viewDetailsButton, { borderColor: colors.primary }]}>
            <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
              View Details
            </Text>
          </View>
        )}
      </View>
    </Pressable>
    <ShareEventModal
      visible={showShareModal}
      onClose={() => setShowShareModal(false)}
      onShare={handleShare}
      event={event}
      sharing={sharing}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    height: 140,
  },
  image: {
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
    fontSize: 48,
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 1,
  },
  featuredBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  dateBadge: {
    position: 'absolute',
    bottom: -20,
    right: 16,
    width: 50,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    padding: isSmallScreen ? 12 : 16,
    paddingTop: isSmallScreen ? 8 : 12,
  },
  title: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
    marginBottom: 10,
    marginRight: 50,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  viewDetailsButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  viewDetailsText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default EventCard;
