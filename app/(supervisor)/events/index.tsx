/**
 * Supervisor Manage Events Screen
 * View and edit events - No delete access
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { getEvents, formatEventDate, formatEventTime } from '../../../services/eventsService';
import { Event, EventStatus } from '../../../types';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Edit3,
  Eye,
  MoreVertical,
  Star,
} from 'lucide-react-native';
import { AnimatedPressable } from '../../../components/AnimatedPressable';

// Status badge colors
const getStatusConfig = (colorScheme: 'light' | 'dark'): Record<EventStatus, { label: string; color: string; bgColor: string }> => {
  const colors = Colors[colorScheme];
  return {
    draft: { label: 'Draft', color: colors.textSecondary, bgColor: colors.surfaceElevated },
    upcoming: { label: 'Upcoming', color: colors.primary, bgColor: colors.primarySoft },
    ongoing: { label: 'Ongoing', color: colors.success, bgColor: colors.successSoft },
    completed: { label: 'Completed', color: colors.textTertiary, bgColor: colors.surfaceElevated },
    cancelled: { label: 'Cancelled', color: colors.error, bgColor: colors.errorSoft },
  };
};

// Filter tabs
const STATUS_FILTERS: { value: EventStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'draft', label: 'Drafts' },
  { value: 'completed', label: 'Completed' },
];

interface EventItemProps {
  event: Event;
  colors: any;
  onView: () => void;
  onEdit: () => void;
}

function EventItem({ event, colors, onView, onEdit }: EventItemProps) {
  const [showActions, setShowActions] = useState(false);
  const colorScheme = useColorScheme();
  const STATUS_CONFIG = getStatusConfig(colorScheme === 'dark' ? 'dark' : 'light');
  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.eventItem, 
        { 
          backgroundColor: pressed ? colors.surfacePressed : colors.card, 
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        }
      ]}
      onPress={onView}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleRow}>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
          {event.isFeatured && (
            <Star size={16} color={colors.star} fill={colors.star} />
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.moreButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
          onPress={() => setShowActions(!showActions)}
        >
          <MoreVertical size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* Event Details */}
      <View style={styles.eventDetails}>
        <View style={styles.detailRow}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {event.eventDate ? formatEventDate(event.eventDate) : 'Date TBA'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {event.startTime ? formatEventTime(event.startTime) : 'Time TBA'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          {event.isVirtual ? (
            <Video size={14} color={colors.primary} />
          ) : (
            <MapPin size={14} color={colors.textSecondary} />
          )}
          <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
            {event.isVirtual ? 'Virtual' : (event.location || 'Location TBA')}
          </Text>
        </View>
        {event.capacity && (
          <View style={styles.detailRow}>
            <Users size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {event.spotsRemaining}/{event.capacity} spots
            </Text>
          </View>
        )}
      </View>

      {/* Actions Dropdown */}
      {showActions && (
        <View style={[styles.actionsDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onView}
          >
            <Eye size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>View</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onEdit}
          >
            <Edit3 size={18} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>Edit</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function SupervisorEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, isSup } = useAuth();

  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | 'all'>('all');

  // Check supervisor access
  useEffect(() => {
    if (user && !isSup) {
      router.back();
    }
  }, [user, isSup, router]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      const response = await getEvents({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        limit: 50,
        userId: user?.id,
      });

      if (response.success && response.data) {
        setEvents(response.data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [selectedStatus]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  // Handle view (public detail page)
  const handleView = useCallback((event: Event) => {
    router.push(`/events/${event.slug}`);
  }, [router]);

  // Handle edit
  const handleEdit = useCallback((event: Event) => {
    router.push(`/(admin)/events/edit/${event.id}`);
  }, [router]);

  // Render event item
  const renderEventItem = useCallback(({ item }: { item: Event }) => (
    <EventItem
      event={item}
      colors={colors}
      onView={() => handleView(item)}
      onEdit={() => handleEdit(item)}
    />
  ), [colors, handleView, handleEdit]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No events found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Create your first event to get started
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.createButtonEmpty, 
            { 
              backgroundColor: '#FF9800',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }
          ]}
          onPress={() => router.push('/events/create')}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={[styles.createButtonEmptyText, { color: '#FFFFFF' }]}>Create Event</Text>
        </Pressable>
      </View>
    );
  }, [loading, colors, router]);

  if (!isSup) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Pressable 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Events</Text>
        <Pressable
          style={({ pressed }) => [
            styles.addButton, 
            { 
              backgroundColor: '#FF9800',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            }
          ]}
          onPress={() => router.push('/events/create')}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Status Filter Tabs */}
      <View style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.filterTab,
                selectedStatus === item.value && { backgroundColor: '#FF9800' },
                selectedStatus !== item.value && { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => setSelectedStatus(item.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { 
                    color: selectedStatus === item.value ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Events Count */}
      {!loading && events.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </Text>
        </View>
      )}

      {/* Events List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading events...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF9800"
              colors={['#FF9800']}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  filterContainer: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  eventItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  moreButton: {
    padding: 4,
    marginRight: -4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  actionsDropdown: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
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
    marginBottom: 24,
  },
  createButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createButtonEmptyText: {
    fontSize: 15,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

