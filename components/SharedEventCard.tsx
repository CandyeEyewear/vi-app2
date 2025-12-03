/**
 * Shared Event Card Component
 * Displays an event card when someone shares it to the feed
 * Clicking on it navigates to the event details page
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Calendar, Clock, MapPin, Users, Video, Ticket, Star, ExternalLink } from 'lucide-react-native';
import { Event, EventCategory } from '../types';
import { Colors } from '../constants/colors';
import { useRouter } from 'expo-router';
import {
  formatEventDate,
  formatEventTime,
  getDaysUntilEvent,
  isEventToday,
  formatCurrency,
} from '../services/eventsService';
import { AnimatedPressable } from './AnimatedPressable';

interface SharedEventCardProps {
  event: Event;
}

const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; emoji: string }> = {
  meetup: { label: 'Meetup', color: '#2196F3', emoji: '🤝' },
  gala: { label: 'Gala', color: '#9C27B0', emoji: '✨' },
  fundraiser: { label: 'Fundraiser', color: '#E91E63', emoji: '💝' },
  workshop: { label: 'Workshop', color: '#FF9800', emoji: '🛠️' },
  celebration: { label: 'Celebration', color: '#4CAF50', emoji: '🎉' },
  networking: { label: 'Networking', color: '#00BCD4', emoji: '🔗' },
  other: { label: 'Event', color: '#757575', emoji: '📅' },
};

export default function SharedEventCard({ event }: SharedEventCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const categoryConfig = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const daysUntil = event.eventDate ? getDaysUntilEvent(event.eventDate) : null;
  const isToday = event.eventDate ? isEventToday(event.eventDate) : false;
  const spotsLeft = event.spotsRemaining ?? event.capacity;
  const hasLimitedSpots = spotsLeft !== undefined && spotsLeft <= 10 && spotsLeft > 0;

  const handlePress = () => {
    router.push(`/events/${event.id}` as any);
  };

  return (
    <AnimatedPressable
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
    >
      {event.imageUrl && (
        <Image source={{ uri: event.imageUrl }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
            <Text style={styles.categoryBadgeText}>
              {categoryConfig.emoji} {categoryConfig.label}
            </Text>
          </View>
          {event.isFeatured && (
            <View style={[styles.featuredBadge, { backgroundColor: '#FFD700' }]}>
              <Star size={12} color="#000" />
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
              <Video size={14} color="#38B6FF" />
              <Text style={[styles.infoText, { color: '#38B6FF' }]}>
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
              <Text style={[styles.freeText, { color: '#4CAF50' }]}>FREE</Text>
            ) : (
              <Text style={[styles.priceText, { color: colors.text }]}>
                {formatCurrency(event.ticketPrice || 0)}
              </Text>
            )}
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
  image: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
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
    backgroundColor: '#FF5722',
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

