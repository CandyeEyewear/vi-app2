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
import { Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Search, X, Calendar, Filter } from 'lucide-react-native';
import { Event, EventCategory } from '../types';
import { Colors } from '../constants/colors';
import { getEvents } from '../services/eventsService';
import { EventCard } from './cards/EventCard';
import { useAuth } from '../contexts/AuthContext';

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
  const PAGE_SIZE = limit || 10;

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

  // Animated Filter Chip Component
  const AnimatedCategoryChip = useCallback(({ category }: { category: typeof EVENT_CATEGORIES[0] }) => {
    const isSelected = selectedCategory === category.value;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const bgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(bgAnim, { toValue: isSelected ? 1 : 0, duration: 200, useNativeDriver: false }).start();
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
        <Pressable onPress={() => setSelectedCategory(category.value)} onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View style={[styles.categoryChip, { backgroundColor, borderColor }]}>
            {isSelected && (
              <View style={styles.chipCheckmark}>
                <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
              </View>
            )}
            <Text style={[styles.categoryChipText, { color: isSelected ? colors.textOnPrimary : colors.text }, isSelected && styles.categoryChipTextSelected]}>
              {category.emoji ? `${category.emoji} ` : ''}{category.label}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  }, [selectedCategory, colors]);

  // Render event item
  const renderEventItem = useCallback(({ item }: { item: Event }) => (
    <EventCard
      event={item}
      onPress={() => handleEventPress(item)}
      onRegisterPress={() => handleRegisterPress(item)}
    />
  ), [handleEventPress, handleRegisterPress]);

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
            <Text style={[styles.clearButtonText, { color: colors.textOnPrimary }]}>Clear Search</Text>
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
            <Pressable onPress={handleClearSearch} style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Category Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {EVENT_CATEGORIES.map((category) => (
              <AnimatedCategoryChip key={category.value} category={category} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results count */}
      {!loading && events.length > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {events.length} {events.length === 1 ? 'event' : 'events'} found
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
        data={events}
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
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 14,
    paddingVertical: isSmallScreen ? 8 : 10,
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
