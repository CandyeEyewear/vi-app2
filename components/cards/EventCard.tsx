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
  TouchableOpacity,
  useColorScheme,
  Dimensions,
} from 'react-native';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Star,
  Share2,
  CheckCircle,
} from 'lucide-react-native';
import { Event, EventCategory } from '../../types';
import { Colors } from '../../constants/colors';
import { EVENT_CATEGORY_CONFIG } from '../../constants/eventCategories';
import {
  formatEventTime,
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
  onShare?: (event: Event) => void;
}

export function EventCard({ event, onPress, onShare }: EventCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { shareEventToFeed } = useFeed();


  const categoryConfig = EVENT_CATEGORY_CONFIG[event.category] || EVENT_CATEGORY_CONFIG.other;
  const spotsLeft = event.spotsRemaining ?? event.capacity ?? 0;
  const hasLimitedSpots = spotsLeft !== undefined && spotsLeft <= 10 && spotsLeft > 0;


  const handleSharePress = () => {
    setShowShareModal(true);
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
      accessibilityLabel={`Event: ${event.title}`}
    >
      {/* Image Section */}
      {event.imageUrl ? (
        <Image 
          source={{ uri: event.imageUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: categoryConfig.color + '20' }]}>
          <Text style={styles.placeholderEmoji}>{categoryConfig.emoji}</Text>
        </View>
      )}
      
      {/* Content Section */}
      <View style={styles.content}>
        {/* Header with Category Badge and Share Button */}
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '15' }]}>
            <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
              {categoryConfig.label.toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {event.isFeatured && (
              <View style={styles.featuredBadge}>
                <Star size={12} color="#000" fill="#000" />
              </View>
            )}
            <TouchableOpacity
              onPress={handleSharePress}
              style={styles.shareButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Share2 size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {event.title || ''}
        </Text>

        {/* Creator/Organization */}
        {event.creator && (
          <View style={styles.orgContainer}>
            <Text style={[styles.orgName, { color: colors.textSecondary }]}>
              {event.creator.fullName || event.creator.username || 'Volunteers Inc'}
            </Text>
          </View>
        )}

        {/* Details Row */}
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
              {event.isVirtual ? 'Virtual Event' : (event.location || '')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatEventTime(event.startTime)}
              {event.endTime && ` - ${formatEventTime(event.endTime)}`}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.detailRow}>
            <Users size={14} color={hasLimitedSpots ? colors.warning : colors.textSecondary} />
            <Text
              style={[
                styles.detailText,
                { 
                  color: hasLimitedSpots ? colors.warning : colors.textSecondary,
                  fontWeight: '600'
                }
              ]}
            >
              {spotsLeft === 0 ? 'Sold out' : `${spotsLeft} spots left`}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.text }]}>
            {(() => {
              const eventDate = new Date(event.eventDate);
              const month = eventDate.toLocaleDateString('en-US', { month: 'short' });
              const day = eventDate.getDate();
              return `${month} ${day}`;
            })()}
          </Text>
        </View>
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
    marginHorizontal: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    flex: 1,
  },
  image: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    padding: 4,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuredBadge: {
    padding: 4,
    borderRadius: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  orgContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orgName: {
    fontSize: 13,
    fontWeight: '500',
  },
  details: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailText: {
    fontSize: 12,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default EventCard;
