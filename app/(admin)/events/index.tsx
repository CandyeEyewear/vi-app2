/**
 * Admin Events List Screen
 * Manage all events - view, edit, delete
 * File: app/admin/events/index.tsx
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
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Edit3,
  Trash2,
  Eye,
  MoreVertical,
  Star,
  List,
} from 'lucide-react-native';
import { Colors } from '../../../constants/colors';
import { Event, EventStatus } from '../../../types';
import {
  getEvents,
  deleteEvent,
  formatEventDate,
  formatEventTime,
} from '../../../services/eventsService';
import { useAuth } from '../../../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Status badge colors
const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: '#757575', bgColor: '#F5F5F5' },
  upcoming: { label: 'Upcoming', color: '#2196F3', bgColor: '#E3F2FD' },
  ongoing: { label: 'Ongoing', color: '#4CAF50', bgColor: '#E8F5E9' },
  completed: { label: 'Completed', color: '#9E9E9E', bgColor: '#FAFAFA' },
  cancelled: { label: 'Cancelled', color: '#F44336', bgColor: '#FFEBEE' },
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
  onDelete: () => void;
  onRegistrations: () => void;
}

function EventItem({ event, colors, onView, onEdit, onDelete, onRegistrations }: EventItemProps) {
  const [showActions, setShowActions] = useState(false);
  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;

  return (
    <TouchableOpacity
      style={[styles.eventItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onView}
      activeOpacity={0.7}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleRow}>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
          {event.isFeatured && (
            <Star size={16} color="#FFD700" fill="#FFD700" />
          )}
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowActions(!showActions)}
        >
          <MoreVertical size={20} color={colors.textSecondary} />
        </TouchableOpacity>
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
            {formatEventDate(event.eventDate)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {formatEventTime(event.startTime)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          {event.isVirtual ? (
            <Video size={14} color="#38B6FF" />
          ) : (
            <MapPin size={14} color={colors.textSecondary} />
          )}
          <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
            {event.isVirtual ? 'Virtual' : event.location}
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

      {/* Action Buttons (when expanded) */}
      {showActions && (
        <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.actionButton} onPress={onView}>
            <Eye size={18} color="#38B6FF" />
            <Text style={[styles.actionText, { color: '#38B6FF' }]}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onRegistrations}>
            <List size={18} color="#9C27B0" />
            <Text style={[styles.actionText, { color: '#9C27B0' }]}>Registrations</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
            <Edit3 size={18} color="#FF9800" />
            <Text style={[styles.actionText, { color: '#FF9800' }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
            <Trash2 size={18} color="#F44336" />
            <Text style={[styles.actionText, { color: '#F44336' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function AdminEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | 'all'>('all');

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      Alert.alert('Access Denied', 'Admin access required');
      router.back();
    }
  }, [user, router]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      const response = await getEvents({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        limit: 50,
        userId: user?.id, // Pass userId so admin can see all events
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

  // Handle view
  const handleView = useCallback((event: Event) => {
    router.push(`/events/${event.id}`);
  }, [router]);

  // Handle edit
  const handleEdit = useCallback((event: Event) => {
    router.push(`/events/edit/${event.id}`);
  }, [router]);

  // Handle registrations
  const handleRegistrations = useCallback((event: Event) => {
    router.push(`/(admin)/events/${event.id}/registrations`);
  }, [router]);

  // Handle delete
  const handleDelete = useCallback((event: Event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteEvent(event.id);
            if (response.success) {
              setEvents(prev => prev.filter(e => e.id !== event.id));
              Alert.alert('Deleted', 'Event has been deleted');
            } else {
              Alert.alert('Error', response.error || 'Failed to delete event');
            }
          },
        },
      ]
    );
  }, []);

  // Render event item
  const renderEventItem = useCallback(({ item }: { item: Event }) => (
    <EventItem
      event={item}
      colors={colors}
      onView={() => handleView(item)}
      onEdit={() => handleEdit(item)}
      onDelete={() => handleDelete(item)}
      onRegistrations={() => handleRegistrations(item)}
    />
  ), [colors, handleView, handleEdit, handleDelete, handleRegistrations]);

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
        <TouchableOpacity
          style={[styles.createButtonEmpty, { backgroundColor: '#38B6FF' }]}
          onPress={() => router.push('/events/create')}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.createButtonEmptyText}>Create Event</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, colors, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Events</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#38B6FF' }]}
          onPress={() => router.push('/events/create')}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
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
            <TouchableOpacity
              style={[
                styles.filterTab,
                selectedStatus === item.value && { backgroundColor: '#38B6FF' },
                selectedStatus !== item.value && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setSelectedStatus(item.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: selectedStatus === item.value ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
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
          <ActivityIndicator size="large" color="#38B6FF" />
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
              tintColor="#38B6FF"
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
  },
  eventItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
