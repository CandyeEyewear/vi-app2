/**
 * EventsList Component
 * Displays a list of events with search and filters
 * File: components/EventsList.tsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  TextInput,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, Calendar, Filter, Check, Bookmark, TrendingUp, Zap } from 'lucide-react-native';
import { Event, EventCategory } from '../types';
import { Colors } from '../constants/colors';
import { getEvents } from '../services/eventsService';
import { EventCard } from './cards/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { showToast } from '../utils/toast';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Category filter options
const EVENT_CATEGORIES: { value: EventCategory | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '' },
  { value: 'meetup', label: 'Meetups', emoji: '' },
  { value: 'gala', label: 'Galas', emoji: '' },
  { value: 'fundraiser', label: 'Fundraisers', emoji: '' },
  { value: 'workshop', label: 'Workshops', emoji: '' },
  { value: 'celebration', label: 'Celebrations', emoji: '' },
  { value: 'networking', label: 'Networking', emoji: '' },
  { value: 'other', label: 'Other', emoji: '' },
];

// Quick filter options
const QUICK_FILTERS = [
  { id: 'featured', label: 'Featured', icon: TrendingUp, description: 'Featured events' },
  { id: 'thisWeek', label: 'This Week', icon: Zap, description: 'Happening this week' },
  { id: 'saved', label: 'Saved', icon: Bookmark, description: 'Your bookmarks' },
];

interface EventsListProps {
  featured?: boolean;
  category?: EventCategory;
  limit?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  onEventPress?: (event: Event) => void;
  onRegisterPress?: (event: Event) => void;
  ListHeaderComponent?: React.ReactElement;
}

// Skeleton component for loading state
function EventSkeleton({ colors }: { colors: any }) {
  return (
    <View style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

function EventsListSkeleton({ colors, count = 3 }: { colors: any; count?: number }) {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <EventSkeleton key={index} colors={colors} />
      ))}
    </View>
  );
}

// Animated Filter Chip Component
const AnimatedFilterChip = React.memo(({
  label,
  isSelected,
  onPress,
  colors,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, { 
      toValue: isSelected ? 1 : 0, 
      duration: 200, 
      useNativeDriver: false 
    }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.card, colors.primary],
  });

  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[
            styles.categoryChip,
            { backgroundColor, borderColor }
          ]}
        >
          {isSelected && (
            <View style={styles.chipCheckmark}>
              <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
            </View>
          )}
          <Text 
            style={[
              styles.categoryChipText, 
              { color: isSelected ? colors.textOnPrimary : colors.text },
              isSelected && styles.categoryChipTextSelected
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

export function EventsList({
  featured,
  category: initialCategory,
  limit,
  showSearch = true,
  showFilters = true,
  onEventPress,
  onRegisterPress,
  ListHeaderComponent,
}: EventsListProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>(initialCategory || 'all');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [savedEventIds, setSavedEventIds] = useState<string[]>([]);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);
  const PAGE_SIZE = limit || 10;

  // Load saved events
  const loadSavedEventIds = useCallback(async () => {
    if (!user?.id) { 
      setSavedEventIds([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('saved_events')
        .select('event_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      setSavedEventIds(data?.map(item => item.event_id) || []);
    } catch (error) {
      console.error('Error loading saved events:', error);
      setSavedEventIds([]);
    }
  }, [user?.id]);

  // Toggle save
  const handleToggleSave = useCallback(async (event: Event) => {
    if (!user) {
      showToast('Please log in to save events', 'error');
      return;
    }
    
    const isSaved = savedEventIds.includes(event.id);
    
    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_events')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', event.id);
        
        if (!error) {
          setSavedEventIds(prev => prev.filter(id => id !== event.id));
          showToast('Removed from saved', 'success');
        }
      } else {
        const { error } = await supabase
          .from('saved_events')
          .insert({
            user_id: user.id,
            event_id: event.id,
          });
        
        if (!error) {
          setSavedEventIds(prev => [...prev, event.id]);
          showToast('Saved for later!', 'success');
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      showToast('Failed to save', 'error');
    }
  }, [user, savedEventIds]);

  // Fetch events
  const fetchEvents = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      }

      const currentOffset = reset ? 0 : offset;

      const response = await getEvents({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        featured: featured,
        limit: PAGE_SIZE,
        offset: currentOffset,
        searchQuery: searchQuery.trim() || undefined,
        upcoming: true,
        userId: user?.id,
      });

      if (response.success && response.data) {
        if (reset) {
          setEvents(response.data);
        } else {
          setEvents(prev => [...prev, ...response.data!]);
        }
        setHasMore(response.data.length === PAGE_SIZE);
        setOffset(currentOffset + response.data.length);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, featured, searchQuery, offset, PAGE_SIZE, user?.id]);

  // Initial load and filter changes
  useEffect(() => {
    fetchEvents(true);
  }, [selectedCategory, searchQuery]);

  // Load saved events on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadSavedEventIds();
    } else {
      setSavedEventIds([]);
    }
  }, [user?.id, loadSavedEventIds]);

  // Filter events based on quick filters
  const filteredEvents = React.useMemo(() => {
    let results = [...events];
    
    if (selectedQuickFilter === 'featured') {
      results = results.filter(event => event.isFeatured);
    } else if (selectedQuickFilter === 'thisWeek') {
      // Filter events happening within the next 7 days
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      results = results.filter(event => {
        if (!event.eventDate) return false;
        const eventDate = new Date(event.eventDate);
        return eventDate >= now && eventDate <= sevenDaysFromNow;
      }).sort((a, b) => {
        const aDate = a.eventDate ? new Date(a.eventDate).getTime() : 0;
        const bDate = b.eventDate ? new Date(b.eventDate).getTime() : 0;
        return aDate - bDate;
      });
    } else if (selectedQuickFilter === 'saved') {
      results = results.filter(event => savedEventIds.includes(event.id));
    }
    
    return results;
  }, [events, selectedQuickFilter, savedEventIds]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents(true);
  }, [fetchEvents]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      fetchEvents(false);
    }
  }, [loadingMore, hasMore, loading, fetchEvents]);

  // Handle event press
  const handleEventPress = useCallback((event: Event) => {
    if (onEventPress) {
      onEventPress(event);
    } else {
      router.push(`/events/${event.id}`);
    }
  }, [onEventPress, router]);

  // Handle register press
  const handleRegisterPress = useCallback((event: Event) => {
    if (onRegisterPress) {
      onRegisterPress(event);
    } else {
      router.push(`/events/${event.id}/register`);
    }
  }, [onRegisterPress, router]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Render event item
  const renderEventItem = useCallback(({ item }: { item: Event }) => (
    <EventCard
      event={item}
      onPress={() => handleEventPress(item)}
      onRegisterPress={() => handleRegisterPress(item)}
      isSaved={savedEventIds.includes(item.id)}
      onToggleSave={() => handleToggleSave(item)}
    />
  ), [handleEventPress, handleRegisterPress, savedEventIds, handleToggleSave]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Calendar size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {searchQuery ? 'No events found' : 'No upcoming events'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {searchQuery
            ? 'Try adjusting your search or filters'
            : 'Check back soon for new events'
          }
        </Text>
        {searchQuery && (
          <Pressable
            style={({ pressed }) => [
              styles.clearButton, 
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
            onPress={handleClearSearch}
          >
            <Text style={styles.clearButtonText}>Clear Search</Text>
          </Pressable>
        )}
      </View>
    );
  }, [loading, searchQuery, colors, handleClearSearch]);

  // Render header
  const renderListHeader = useCallback(() => (
    <View style={styles.listHeader}>
      {ListHeaderComponent}

      {/* Search Bar */}
      {showSearch && (
        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search events..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Category Filters and Quick Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {EVENT_CATEGORIES.map((category) => (
              <AnimatedFilterChip
                key={category.value}
                label={`${category.emoji ? category.emoji + ' ' : ''}${category.label}`}
                isSelected={selectedCategory === category.value && !selectedQuickFilter}
                onPress={() => {
                  setSelectedCategory(category.value);
                  setSelectedQuickFilter(null);
                }}
                colors={colors}
              />
            ))}
            
            <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
            
            {QUICK_FILTERS.map((filter) => (
              <AnimatedFilterChip
                key={filter.id}
                label={filter.label}
                isSelected={selectedQuickFilter === filter.id}
                onPress={() => {
                  if (selectedQuickFilter === filter.id) {
                    setSelectedQuickFilter(null);
                  } else {
                    setSelectedQuickFilter(filter.id);
                    setSelectedCategory('all');
                  }
                }}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results count */}
      {!loading && filteredEvents.length > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
          </Text>
        </View>
      )}
    </View>
  ), [
    ListHeaderComponent,
    showSearch,
    showFilters,
    searchQuery,
    selectedCategory,
    events.length,
    loading,
    colors,
    handleClearSearch,
  ]);

  // Render footer (loading more indicator)
  const renderListFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
          Loading more...
        </Text>
      </View>
    );
  }, [loadingMore, colors]);

  // Show skeleton while loading
  if (loading && events.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderListHeader()}
        <EventsListSkeleton colors={colors} count={3} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredEvents}
        renderItem={renderEventItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={renderListFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    flexGrow: 1,
  },
  listHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 10 : 12,
    marginBottom: 16,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 16,
  },
  filtersContainer: {
    marginBottom: 12,
  },
  categoriesContent: {
    gap: 8,
  },
  filterDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    position: 'relative',
  },
  chipCheckmark: {
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    fontWeight: '600',
  },
  resultsInfo: {
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 13,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
  },
  // Skeleton styles
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  skeletonImage: {
    height: 140,
    width: '100%',
  },
  skeletonContent: {
    padding: 16,
    gap: 12,
  },
  skeletonTitle: {
    height: 20,
    borderRadius: 4,
    width: '70%',
  },
  skeletonText: {
    height: 14,
    borderRadius: 4,
    width: '100%',
  },
  skeletonButton: {
    height: 44,
    borderRadius: 10,
    width: '100%',
    marginTop: 8,
  },
});

export default EventsList;
