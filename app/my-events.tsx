/**
 * My Events Screen
 * Lists all event registrations with tickets and check-in status
 * File: app/my-events.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  CheckCircle,
  Clock,
  Video,
} from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { EventRegistration } from '../types';
import { getUserRegistrations, formatEventDate, formatEventTime } from '../services/eventsService';
import { useAuth } from '../contexts/AuthContext';
import { getCheckInStats } from '../services/eventTicketsService';

interface RegistrationWithStats extends EventRegistration {
  checkInStats?: {
    totalTickets: number;
    checkedInCount: number;
    pendingCount: number;
  };
}

export default function MyEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  const [registrations, setRegistrations] = useState<RegistrationWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRegistrations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await getUserRegistrations(user.id, {
        status: 'registered',
        upcoming: false, // Show all events
      });

      if (response.success && response.data) {
        // Load check-in stats for each registration
        const registrationsWithStats = await Promise.all(
          response.data.map(async (reg) => {
            const stats = await getCheckInStats(reg.id);
            return {
              ...reg,
              checkInStats: stats,
            };
          })
        );

        setRegistrations(registrationsWithStats);
      }
    } catch (error) {
      console.error('Error loading registrations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadRegistrations();
  }, [loadRegistrations]);

  const renderEventCard = ({ item }: { item: RegistrationWithStats }) => {
    const event = item.event;
    if (!event) return null;

    const stats = item.checkInStats;
    const allCheckedIn = stats && stats.checkedInCount === stats.totalTickets && stats.totalTickets > 0;
    const someCheckedIn = stats && stats.checkedInCount > 0 && stats.checkedInCount < stats.totalTickets;

    return (
      <TouchableOpacity
        style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/my-events/${item.id}`)}
        activeOpacity={0.7}
      >
        {event.imageUrl && (
          <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
        )}
        <View style={styles.eventContent}>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.eventDetails}>
            {event.eventDate && (
              <View style={styles.detailRow}>
                <Calendar size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {formatEventDate(event.eventDate)}
                </Text>
              </View>
            )}

            {event.startTime && (
              <View style={styles.detailRow}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {formatEventTime(event.startTime)}
                </Text>
              </View>
            )}

            {event.location && (
              <View style={styles.detailRow}>
                {event.isVirtual ? (
                  <Video size={14} color={colors.textSecondary} />
                ) : (
                  <MapPin size={14} color={colors.textSecondary} />
                )}
                <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {event.isVirtual ? 'Virtual Event' : event.location}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.ticketInfo}>
            <View style={[styles.ticketBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ticket size={16} color={colors.primary} />
              <Text style={[styles.ticketText, { color: colors.primary }]}>
                {item.ticketCount} ticket{item.ticketCount !== 1 ? 's' : ''}
              </Text>
            </View>

            {stats && stats.totalTickets > 0 && (
              <View style={[
                styles.checkInBadge,
                allCheckedIn && { backgroundColor: colors.success + '15' },
                someCheckedIn && { backgroundColor: colors.warning + '15' },
                !allCheckedIn && !someCheckedIn && { backgroundColor: colors.textSecondary + '15' },
              ]}>
                {allCheckedIn ? (
                  <CheckCircle size={14} color={colors.success} />
                ) : (
                  <Clock size={14} color={someCheckedIn ? colors.warning : colors.textSecondary} />
                )}
                <Text style={[
                  styles.checkInText,
                  { color: allCheckedIn ? colors.success : someCheckedIn ? colors.warning : colors.textSecondary }
                ]}>
                  {stats.checkedInCount}/{stats.totalTickets} checked in
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Events</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Events</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Events List */}
      {registrations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ticket size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Events Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Register for events to see your tickets here
          </Text>
        </View>
      ) : (
        <FlatList
          data={registrations}
          renderItem={renderEventCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  eventCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  eventContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  eventDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ticketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ticketText: {
    fontSize: 13,
    fontWeight: '600',
  },
  checkInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  checkInText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});

