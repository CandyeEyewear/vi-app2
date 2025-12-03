/**
 * CausesList Component
 * Displays a list of fundraising causes with search and filters
 * File: components/CausesList.tsx
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
  Keyboard,
  Animated,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { Cause, CauseCategory } from '../types';
import { Colors } from '../constants/colors';
import { getCauses } from '../services/causesService';
import { CauseCard } from './cards/CauseCard';
import { EmptyState } from './EmptyState';
import { useAuth } from '../contexts/AuthContext';

const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;

// Category filter options
const CAUSE_CATEGORIES: { value: CauseCategory | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '' },
  { value: 'disaster_relief', label: 'Disaster Relief', emoji: '' },
  { value: 'education', label: 'Education', emoji: '' },
  { value: 'healthcare', label: 'Healthcare', emoji: '' },
  { value: 'environment', label: 'Environment', emoji: '' },
  { value: 'community', label: 'Community', emoji: '' },
  { value: 'poverty', label: 'Poverty Relief', emoji: '' },
  { value: 'other', label: 'Other', emoji: '' },
];

interface CausesListProps {
  featured?: boolean;
  category?: CauseCategory;
  limit?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  onCausePress?: (cause: Cause) => void;
  onDonatePress?: (cause: Cause) => void;
  ListHeaderComponent?: React.ReactElement;
  isSearchExpanded?: boolean;
  onSearchExpandChange?: (expanded: boolean) => void;
}

// Skeleton component for loading state
function CauseSkeleton({ colors }: { colors: any }) {
  return (
    <View style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.skeletonImage, { backgroundColor: colors.border }]} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonTitle, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonDescription, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonProgress, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonStats, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonButton, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

function CausesListSkeleton({ colors, count = 3 }: { colors: any; count?: number }) {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <CauseSkeleton key={index} colors={colors} />
      ))}
    </View>
  );
}

export function CausesList({
  featured,
  category: initialCategory,
  limit,
  showSearch = true,
  showFilters = true,
  onCausePress,
  onDonatePress,
  ListHeaderComponent,
  isSearchExpanded: externalIsSearchExpanded,
  onSearchExpandChange,
}: CausesListProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();

  // State
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CauseCategory | 'all'>(initialCategory || 'all');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [internalIsSearchExpanded, setInternalIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const PAGE_SIZE = limit || 10;
  
  // Use external state if provided, otherwise use internal state
  const isSearchExpanded = externalIsSearchExpanded !== undefined ? externalIsSearchExpanded : internalIsSearchExpanded;
  const setIsSearchExpanded = (expanded: boolean) => {
    if (onSearchExpandChange) {
      onSearchExpandChange(expanded);
    } else {
      setInternalIsSearchExpanded(expanded);
    }
  };

  // Fetch causes
  const fetchCauses = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      }

      const currentOffset = reset ? 0 : offset;

      const response = await getCauses({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        featured: featured,
        limit: PAGE_SIZE,
        offset: currentOffset,
        searchQuery: searchQuery.trim() || undefined,
        status: 'active',
        userId: user?.id,
      });

      if (response.success && response.data) {
        if (reset) {
          setCauses(response.data);
        } else {
          setCauses(prev => [...prev, ...response.data!]);
        }
        setHasMore(response.data.length === PAGE_SIZE);
        setOffset(currentOffset + response.data.length);
      }
    } catch (error) {
      console.error('Error fetching causes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, featured, searchQuery, offset, PAGE_SIZE]);

  // Initial load and filter changes
  useEffect(() => {
    fetchCauses(true);
  }, [selectedCategory, searchQuery]);

  // Focus search input when expanded
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchExpanded]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCauses(true);
  }, [fetchCauses]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      fetchCauses(false);
    }
  }, [loadingMore, hasMore, loading, fetchCauses]);

  // Handle cause press
  const handleCausePress = useCallback((cause: Cause) => {
    if (onCausePress) {
      onCausePress(cause);
    } else {
      router.push(`/causes/${cause.id}`);
    }
  }, [onCausePress, router]);

  // Handle donate press
  const handleDonatePress = useCallback((cause: Cause) => {
    if (onDonatePress) {
      onDonatePress(cause);
    } else {
      router.push(`/causes/${cause.id}/donate`);
    }
  }, [onDonatePress, router]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Animated Filter Chip Component
  const AnimatedCategoryChip = useCallback(({ category }: { category: typeof CAUSE_CATEGORIES[0] }) => {
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
              {category.label}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  }, [selectedCategory, colors]);

  // Render cause item
  const renderCauseItem = useCallback(({ item }: { item: Cause }) => (
    <CauseCard
      cause={item}
      onPress={() => handleCausePress(item)}
      onDonatePress={() => handleDonatePress(item)}
    />
  ), [handleCausePress, handleDonatePress]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {searchQuery ? 'No causes found' : 'No active causes'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {searchQuery 
            ? 'Try adjusting your search or filters'
            : 'Check back soon for new fundraising campaigns'
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
      
      {/* Search Bar - Only show when expanded */}
      {showSearch && isSearchExpanded && (
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border, flex: 1, marginRight: 8 }]}>
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search causes..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onBlur={() => {
                if (!searchQuery.trim()) {
                  setIsSearchExpanded(false);
                }
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleClearSearch} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => {
              setIsSearchExpanded(false);
              setSearchQuery('');
              Keyboard.dismiss();
            }}
            style={({ pressed }) => [
              styles.closeSearchButton, 
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.7 }
            ]}
            accessibilityLabel="Close search"
          >
            <X size={18} color={colors.text} />
          </Pressable>
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
            {CAUSE_CATEGORIES.map((category) => (
              <AnimatedCategoryChip key={category.value} category={category} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results count */}
      {!loading && causes.length > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {causes.length} {causes.length === 1 ? 'cause' : 'causes'} found
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
    causes.length,
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
  if (loading && causes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderListHeader()}
        <CausesListSkeleton colors={colors} count={3} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={causes}
        renderItem={renderCauseItem}
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 10 : 12,
    borderWidth: 1,
    gap: 8,
  },
  closeSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
    height: 160,
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
  skeletonDescription: {
    height: 16,
    borderRadius: 4,
    width: '100%',
  },
  skeletonProgress: {
    height: 8,
    borderRadius: 4,
    width: '100%',
  },
  skeletonStats: {
    height: 14,
    borderRadius: 4,
    width: '50%',
  },
  skeletonButton: {
    height: 44,
    borderRadius: 10,
    width: '100%',
  },
});

export default CausesList;
