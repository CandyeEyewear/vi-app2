/**
 * Discover Tab Screen
 * Browse and search volunteer opportunities with advanced search features
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  useColorScheme,
  Keyboard,
  Platform,
  Pressable,
  Dimensions,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Search, X, MapPin, Filter, ChevronDown, Clock, Users, CheckCircle, SlidersHorizontal, TrendingUp, Zap, Bookmark, Lightbulb, Share2 } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Opportunity, OpportunityCategory } from '../../types';
import { Colors } from '../../constants/colors';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { supabase } from '../../services/supabase';
import { OpportunitiesSkeleton } from '../../components/SkeletonLayouts';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../../components/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { CausesList } from '../../components/CausesList';
import { EventsList } from '../../components/EventsList';
import WebContainer from '../../components/WebContainer';
import Head from 'expo-router/head';
import {
  searchOpportunities,
  getSearchHistory,
  saveSearchToHistory,
  clearSearchHistory,
  getCachedSearch,
  cacheSearchResults,
  generateSearchSuggestions,
  trackSearchAnalytics,
  SearchOptions,
} from '../../services/searchService';

// Screen width detection for responsive design
const screenWidth = Dimensions.get('window').width;
const isSmallScreen = screenWidth < 380;
const isLargeScreen = screenWidth > 420;

const CATEGORIES: { value: OpportunityCategory | 'all' | 'nearMe'; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: 'All' },
  { value: 'nearMe', label: '📍 Near Me' },
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'poorRelief', label: 'Poor Relief' },
  { value: 'community', label: 'Community' },
  { value: 'viEngage', label: 'VI Engage' },
];

const QUICK_FILTERS = [
  { 
    id: 'trending', 
    label: 'Trending', 
    icon: TrendingUp,
    description: 'Most popular this week'
  },
  { 
    id: 'filling', 
    label: 'Filling Fast', 
    icon: Zap,
    description: 'Spots filling up'
  },
  { 
    id: 'saved', 
    label: 'Saved', 
    icon: Bookmark,
    description: 'Your bookmarks'
  },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'distance', label: 'Nearest First' },
  { value: 'date', label: 'Date (Soonest)' },
  { value: 'spots', label: 'Most Spots' },
] as const;

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'upcoming', label: 'Upcoming' },
] as const;

// Enhanced Search Bar Component (without dropdown - dropdown rendered separately)
const SearchBar = React.memo(({ 
  searchQuery, 
  onSearchChange, 
  onClearSearch, 
  searchInputRef,
  colors,
  onFocus,
  onBlur,
  onHideSuggestions,
  onLayout,
  searchBarRef,
}: {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  searchInputRef: React.RefObject<TextInput | null>;
  colors: any;
  onFocus: () => void;
  onBlur: () => void;
  onHideSuggestions: () => void;
  onLayout?: (event: any) => void;
  searchBarRef?: React.RefObject<View | null>;
}) => {
  return (
    <View ref={searchBarRef as any} onLayout={onLayout} style={styles.searchWrapper}>
  <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
    <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
    <TextInput
      ref={searchInputRef}
      style={[styles.searchInput, { color: colors.text }]}
      placeholder="Search opportunities..."
      placeholderTextColor={colors.textSecondary}
      value={searchQuery}
      onChangeText={onSearchChange}
          onFocus={onFocus}
          onBlur={onBlur}
      autoCorrect={false}
      autoCapitalize="none"
          returnKeyType="search"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (searchQuery.trim()) {
              Keyboard.dismiss();
              onHideSuggestions();
            }
          }}
          accessibilityLabel="Search opportunities"
          accessibilityHint="Type to search for volunteer opportunities by title, organization, location, or description"
    />
    {searchQuery.length > 0 && (
      <TouchableOpacity 
        onPress={onClearSearch}
            accessibilityLabel="Clear search"
      >
        <X size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    )}
  </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.colors === nextProps.colors
  );
});

// Suggestions Dropdown Component - Rendered separately outside FlatList
const SuggestionsDropdown = React.memo(({
  visible,
  suggestions,
  searchHistory,
  searchQuery,
  colors,
  onSelectSuggestion,
  onSelectHistory,
  onClose,
  topPosition,
}: {
  visible: boolean;
  suggestions: string[];
  searchHistory: string[];
  searchQuery: string;
  colors: any;
  onSelectSuggestion: (suggestion: string) => void;
  onSelectHistory: (history: string) => void;
  onClose: () => void;
  topPosition: number;
}) => {
  const hasSuggestions = suggestions.length > 0;
  const showDropdown = visible && hasSuggestions;

  if (!showDropdown) return null;

  return (
    <View 
      style={[
        styles.suggestionsDropdownWrapper, 
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          top: topPosition,
        }
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.suggestionsContainer}>
        {hasSuggestions && (
          <>
            <View style={styles.suggestionsHeader}>
              <Search size={14} color={colors.textSecondary} />
              <Text style={[styles.suggestionsHeaderText, { color: colors.textSecondary }]}>Suggestions</Text>
            </View>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`suggestion-${index}`}
                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onSelectSuggestion(suggestion);
                }}
                activeOpacity={0.7}
              >
                <Search size={16} color={colors.textSecondary} />
                <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.visible === nextProps.visible &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.suggestions.length === nextProps.suggestions.length &&
    prevProps.searchHistory.length === nextProps.searchHistory.length &&
    JSON.stringify(prevProps.suggestions) === JSON.stringify(nextProps.suggestions) &&
    JSON.stringify(prevProps.searchHistory) === JSON.stringify(nextProps.searchHistory)
  );
});


// Filter Panel Component
const FilterPanel = React.memo(({
  visible,
  onClose,
  colors,
  dateRange,
  onDateRangeChange,
  maxDistance,
  onMaxDistanceChange,
  minSpotsAvailable,
  onMinSpotsAvailableChange,
  organizationVerified,
  onOrganizationVerifiedChange,
  sortBy,
  onSortByChange,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  maxDistance: number | undefined;
  onMaxDistanceChange: (value: number | undefined) => void;
  minSpotsAvailable: number | undefined;
  onMinSpotsAvailableChange: (value: number | undefined) => void;
  organizationVerified: boolean | undefined;
  onOrganizationVerifiedChange: (value: boolean | undefined) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.filterPanelHeader}>
        <Text style={[styles.filterPanelTitle, { color: colors.text }]}>Filters</Text>
        <TouchableOpacity onPress={onClose}>
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sort By */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
        <View style={styles.filterOptions}>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                { backgroundColor: colors.background, borderColor: colors.border },
                sortBy === option.value && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => onSortByChange(option.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  sortBy === option.value && { color: '#FFFFFF' },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Date Range</Text>
        <View style={styles.filterOptions}>
          {DATE_RANGE_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                { backgroundColor: colors.background, borderColor: colors.border },
                dateRange === option.value && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => onDateRangeChange(option.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  dateRange === option.value && { color: '#FFFFFF' },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Distance Filter */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Maximum Distance</Text>
        <View style={styles.filterOptions}>
          {[5, 10, 25, 50, 100].map(distance => (
            <TouchableOpacity
              key={distance}
              style={[
                styles.filterChip,
                { backgroundColor: colors.background, borderColor: colors.border },
                maxDistance === distance && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => onMaxDistanceChange(maxDistance === distance ? undefined : distance)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  maxDistance === distance && { color: '#FFFFFF' },
                ]}
              >
                {distance} mi
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: colors.background, borderColor: colors.border },
              maxDistance === undefined && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
            onPress={() => onMaxDistanceChange(undefined)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: colors.textSecondary },
                maxDistance === undefined && { color: '#FFFFFF' },
              ]}
            >
              Any
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Spots Available */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Minimum Spots Available</Text>
        <View style={styles.filterOptions}>
          {[1, 5, 10, 20].map(spots => (
            <TouchableOpacity
              key={spots}
              style={[
                styles.filterChip,
                { backgroundColor: colors.background, borderColor: colors.border },
                minSpotsAvailable === spots && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}
              onPress={() => onMinSpotsAvailableChange(minSpotsAvailable === spots ? undefined : spots)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  minSpotsAvailable === spots && { color: '#FFFFFF' },
                ]}
              >
                {spots}+
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Organization Verified */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Organization</Text>
        <View style={styles.filterOptions}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: colors.background, borderColor: colors.border },
              organizationVerified === true && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
            onPress={() => onOrganizationVerifiedChange(organizationVerified === true ? undefined : true)}
          >
            <CheckCircle size={14} color={organizationVerified === true ? '#FFFFFF' : colors.textSecondary} />
            <Text
              style={[
                styles.filterChipText,
                { color: colors.textSecondary, marginLeft: 4 },
                organizationVerified === true && { color: '#FFFFFF' },
              ]}
            >
              Verified Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// TabBar Component
const TabBar = React.memo(({
  activeTab,
  onTabChange,
  colors,
}: {
  activeTab: 'opportunities' | 'causes' | 'events';
  onTabChange: (tab: 'opportunities' | 'causes' | 'events') => void;
  colors: any;
}) => {
  const tabs = [
    { id: 'opportunities' as const, label: 'Opportunities' },
    { id: 'causes' as const, label: 'Causes' },
    { id: 'events' as const, label: 'Events' },
  ];

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? '#38B6FF' : 'transparent',
                },
              ]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.activeTab === nextProps.activeTab && prevProps.colors === nextProps.colors;
});

// QuickFilters Component
const QuickFilters = React.memo(({
  onSelectFilter,
  selectedFilter,
  colors,
  trendingCount,
  fillingCount,
  savedCount,
}: {
  onSelectFilter: (filterId: string) => void;
  selectedFilter: string | null;
  colors: any;
  trendingCount: number;
  fillingCount: number;
  savedCount: number;
}) => {
  const counts = {
    trending: trendingCount,
    filling: fillingCount,
    saved: savedCount,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.quickFiltersContainer}
      contentContainerStyle={[styles.quickFiltersContent, { paddingHorizontal: isSmallScreen ? 12 : 16 }]}
    >
      {QUICK_FILTERS.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selectedFilter === filter.id;
        const count = counts[filter.id as keyof typeof counts];

        return (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.quickFilterPill,
              {
                backgroundColor: isSelected ? colors.tint : colors.card,
                borderColor: isSelected ? colors.tint : colors.border,
                paddingHorizontal: isSmallScreen ? 10 : 12,
                paddingVertical: isSmallScreen ? 6 : 8,
              },
            ]}
            onPress={() => onSelectFilter(filter.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${filter.label}${count > 0 ? `, ${count} available` : ''}`}
          >
            <Icon
              size={isSmallScreen ? 14 : 16}
              color={isSelected ? '#FFFFFF' : colors.text}
              style={{ marginRight: isSmallScreen ? 4 : 6 }}
            />
            <Text
              style={[
                styles.quickFilterPillText,
                { 
                  color: isSelected ? '#FFFFFF' : colors.text,
                  fontSize: isSmallScreen ? 12 : 14,
                },
              ]}
            >
              {filter.label}
            </Text>
            {count > 0 && (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.tint },
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    { color: '#FFFFFF', fontSize: isSmallScreen ? 10 : 11 },
                  ]}
                >
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.selectedFilter === nextProps.selectedFilter &&
    prevProps.trendingCount === nextProps.trendingCount &&
    prevProps.fillingCount === nextProps.fillingCount &&
    prevProps.savedCount === nextProps.savedCount
  );
});

export default function DiscoverScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 992;
  const { isAdmin, user } = useAuth();
  
  const categoryScrollRef = useRef<FlatList>(null);
  const searchInputRef = useRef<TextInput | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View | null>(null);
  const [searchBarLayout, setSearchBarLayout] = useState({ y: 0, height: 0 });
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<OpportunityCategory | 'all' | 'nearMe'>(
    (params.category as any) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState((params.query as string) || '');
  const [searchInputValue, setSearchInputValue] = useState((params.query as string) || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<string[]>([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isCausesSearchExpanded, setIsCausesSearchExpanded] = useState(false);
  
  // Swipeable refs for opportunity cards
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'opportunities' | 'causes' | 'events'>('opportunities');
  
  // Tab cache state - track which tabs have been loaded
  const [tabCache, setTabCache] = useState<{
    opportunities: boolean;
    causes: boolean;
    events: boolean;
  }>({
    opportunities: true, // Opportunities tab is active by default
    causes: false,
    events: false,
  });
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<string>('all');
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined);
  const [minSpotsAvailable, setMinSpotsAvailable] = useState<number | undefined>(undefined);
  const [organizationVerified, setOrganizationVerified] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('relevance');
  
  // Location state
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [requestingLocation, setRequestingLocation] = useState(false);

  // Pagination
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  // Load search history function
  const loadSearchHistory = async () => {
    const history = await getSearchHistory();
    setSearchHistory(history);
  };

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Load saved opportunity IDs
  const loadSavedOpportunityIds = useCallback(async () => {
    if (!user?.id) {
      setSavedOpportunityIds([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('opportunity_id')
        .eq('user_id', user.id);

      if (error) throw error;
      const savedIds = data?.map(item => item.opportunity_id) || [];
      setSavedOpportunityIds(savedIds);
    } catch (error) {
      console.error('Error loading saved opportunities:', error);
      setSavedOpportunityIds([]);
    }
  }, [user?.id]);

  // Load saved opportunity IDs when user changes
  useEffect(() => {
    if (user?.id) {
      loadSavedOpportunityIds();
    } else {
      setSavedOpportunityIds([]);
    }
  }, [user?.id, loadSavedOpportunityIds]);

  // Calculate distance between two coordinates in miles using Haversine formula
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in miles
  };

  // Request location permission and get coordinates
  const getUserLocation = async () => {
    try {
      setRequestingLocation(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        setLocationPermission(false);
        setRequestingLocation(false);
        return;
      }
      
      setLocationPermission(true);
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      console.log('📍 User location:', location.coords);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationPermission(false);
    } finally {
      setRequestingLocation(false);
    }
  };

  // Get location when "Near Me" is selected
  useEffect(() => {
    if (selectedCategory === 'nearMe' && !userLocation && !requestingLocation) {
      getUserLocation();
    }
  }, [selectedCategory]);

  const loadOpportunities = async (append: boolean = false) => {
    try {
      if (!append) {
      setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      // Build Supabase query with server-side filtering where possible
      let query = supabase
        .from('opportunities')
        .select('*')
        .eq('status', 'active')
        .or('proposal_status.is.null,proposal_status.eq.approved');

      // Server-side category filter
      if (selectedCategory !== 'all' && selectedCategory !== 'nearMe') {
        query = query.eq('category', selectedCategory);
      }


      // Order by date
      query = query.order('date', { ascending: true });

      // Pagination
      if (append) {
        query = query.range(opportunities.length, opportunities.length + PAGE_SIZE - 1);
      } else {
        query = query.limit(PAGE_SIZE);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const opportunitiesData: Opportunity[] = (data || []).map((opp) => {
        // Calculate distance if user location exists
        let distance: number | undefined;
        if (userLocation && opp.latitude && opp.longitude) {
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            opp.latitude,
            opp.longitude
          );
        }

        return {
          id: opp.id,
          title: opp.title,
          description: opp.description,
          organizationName: opp.organization_name,
          organizationVerified: opp.organization_verified,
          category: opp.category,
          location: opp.location,
          latitude: opp.latitude,
          longitude: opp.longitude,
          mapLink: opp.map_link,
          date: opp.date,
          dateStart: opp.date_start,
          dateEnd: opp.date_end,
          timeStart: opp.time_start,
          timeEnd: opp.time_end,
          duration: opp.duration,
          spotsAvailable: opp.spots_available,
          spotsTotal: opp.spots_total,
          requirements: opp.requirements,
          skillsNeeded: opp.skills_needed,
          impactStatement: opp.impact_statement,
          imageUrl: opp.image_url,
          status: opp.status,
          createdBy: opp.created_by,
          createdAt: opp.created_at,
          updatedAt: opp.updated_at,
          distance,
        };
      });

      // Filter out past opportunities for non-admin users
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let filteredData = opportunitiesData;
      if (!isAdmin) {
        filteredData = opportunitiesData.filter((opp) => {
          const opportunityDate = opp.dateEnd 
            ? new Date(opp.dateEnd)
            : opp.date 
            ? new Date(opp.date)
            : null;
          
          if (!opportunityDate) return true;
          
          const oppDateEnd = new Date(opportunityDate);
          oppDateEnd.setHours(23, 59, 59, 999);
          
          return oppDateEnd >= today;
        });
      }

      if (append) {
        setOpportunities(prev => [...prev, ...filteredData]);
        setHasMore(filteredData.length === PAGE_SIZE);
      } else {
      setOpportunities(filteredData);
        setHasMore(filteredData.length === PAGE_SIZE);
      }
    } catch (error: any) {
      console.error('Error loading opportunities:', error);
      setError(error.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, [selectedCategory]);

  // Reload when user location changes
  useEffect(() => {
    if (userLocation) {
      loadOpportunities();
    }
  }, [userLocation]);

  // Memoize filtered opportunities with advanced search and quick filters
  const filteredOpportunities = useMemo(() => {
    if (opportunities.length === 0) return [];

    let results = [...opportunities];

    // Phase 4: Apply quick filters first
    if (selectedQuickFilter === 'trending') {
      // Sort by most popular (using spots available as proxy for popularity)
      // In a real app, you'd use views/saves from database
      results.sort((a, b) => {
        const aScore = (a.spotsTotal - a.spotsAvailable) || 0;
        const bScore = (b.spotsTotal - b.spotsAvailable) || 0;
        return bScore - aScore;
      });
    } else if (selectedQuickFilter === 'filling') {
      // Filter opportunities with few spots left
      results = results.filter(opp => {
        const spotsLeft = opp.spotsAvailable;
        return spotsLeft > 0 && spotsLeft <= 5;
      }).sort((a, b) => {
        return a.spotsAvailable - b.spotsAvailable;
      });
    } else if (selectedQuickFilter === 'saved') {
      // Filter saved opportunities from database
      results = results.filter(opp => savedOpportunityIds.includes(opp.id));
    }

    // Apply client-side filters
    if (dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dateRange === 'today') {
        results = results.filter(opp => {
          const oppDate = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null;
          if (!oppDate) return false;
          const oppDateOnly = new Date(oppDate);
          oppDateOnly.setHours(0, 0, 0, 0);
          return oppDateOnly.getTime() === today.getTime();
        });
      } else if (dateRange === 'thisWeek') {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        results = results.filter(opp => {
          const oppDate = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null;
          if (!oppDate) return false;
          return new Date(oppDate) >= today && new Date(oppDate) <= weekEnd;
        });
      } else if (dateRange === 'thisMonth') {
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        results = results.filter(opp => {
          const oppDate = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null;
          if (!oppDate) return false;
          return new Date(oppDate) >= today && new Date(oppDate) <= monthEnd;
        });
      }
    }
    
    if (minSpotsAvailable !== undefined) {
      results = results.filter(opp => opp.spotsAvailable >= minSpotsAvailable);
    }
    
    if (organizationVerified !== undefined) {
      results = results.filter(opp => opp.organizationVerified === organizationVerified);
    }
    
    if (maxDistance !== undefined && userLocation) {
      results = results.filter(opp => {
        if (!opp.distance) return false;
        return opp.distance <= maxDistance;
      });
    }
    
    // Sort results
    if (sortBy === 'date') {
      results.sort((a, b) => {
        const aDate = a.dateEnd ? new Date(a.dateEnd) : a.date ? new Date(a.date) : new Date(0);
        const bDate = b.dateEnd ? new Date(b.dateEnd) : b.date ? new Date(b.date) : new Date(0);
        return aDate.getTime() - bDate.getTime();
      });
    } else if (sortBy === 'spots') {
      results.sort((a, b) => b.spotsAvailable - a.spotsAvailable);
    } else if (sortBy === 'distance' && userLocation) {
      results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    // Filter by "Near Me" if selected
    if (selectedCategory === 'nearMe') {
      // First, filter to only opportunities with location data
      results = results.filter((opp) => 
        opp.latitude && opp.longitude
      );
      
      // If distances are calculated, filter by distance threshold
      // If distances aren't calculated yet (still loading), show all with location
      const hasDistances = results.some(opp => opp.distance !== undefined);
      if (hasDistances) {
        results = results.filter((opp) => 
        opp.distance !== undefined &&
          opp.distance <= (maxDistance || 30)
        );
        
        // Sort by distance if not already sorted
        if (sortBy !== 'distance') {
          results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        }
      }
      // If distances aren't available yet, show all opportunities with location
      // They will be filtered once loadOpportunities calculates distances
    }

    const searchOptions: SearchOptions = {
      query: searchQuery,
      category: selectedCategory !== 'all' && selectedCategory !== 'nearMe' ? selectedCategory : undefined,
      dateRange: dateRange !== 'all' ? dateRange as any : undefined,
      maxDistance: maxDistance,
      minSpotsAvailable: minSpotsAvailable,
      organizationVerified: organizationVerified,
      sortBy: sortBy as any,
    };

    // Use search service for client-side filtering and ranking
    results = searchOpportunities(results, searchOptions);

    // Track analytics
    if (searchQuery.trim()) {
      trackSearchAnalytics(searchQuery, results.length);
    }

    return results;
  }, [opportunities, selectedCategory, selectedQuickFilter, savedOpportunityIds, searchQuery, dateRange, maxDistance, minSpotsAvailable, organizationVerified, sortBy]);

  // Debounced search query for suggestions (Phase 5)
  const debouncedSearchQuery = useDebounce(searchInputValue, 300);

  // Generate search suggestions - memoized to prevent recalculation on every render
  const suggestions = useMemo(() => {
    // Only generate suggestions if we have opportunities and input is meaningful
    if (opportunities.length === 0) return [];
    if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) return [];
    return generateSearchSuggestions(opportunities, debouncedSearchQuery, 5);
  }, [debouncedSearchQuery, opportunities]); // Use debounced query

  const handleOpportunityPress = useCallback((opportunity: Opportunity) => {
    trackSearchAnalytics(searchQuery, filteredOpportunities.length, opportunity.id);
    router.push(`/opportunity/${opportunity.id}`);
  }, [router, searchQuery, filteredOpportunities.length]);

  // Handle save/unsave opportunity
  const handleToggleSave = useCallback(async (opportunity: Opportunity) => {
    if (!user) return;
    
    const isSaved = savedOpportunityIds.includes(opportunity.id);
    
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from('saved_opportunities')
          .delete()
          .eq('user_id', user.id)
          .eq('opportunity_id', opportunity.id);
        
        if (!error) {
          setSavedOpportunityIds(prev => prev.filter(id => id !== opportunity.id));
        }
      } else {
        // Save
        const { error } = await supabase
          .from('saved_opportunities')
          .insert({
            user_id: user.id,
            opportunity_id: opportunity.id,
          });
        
        if (!error) {
          setSavedOpportunityIds(prev => [...prev, opportunity.id]);
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  }, [user, savedOpportunityIds]);

  // Handle share opportunity
  const handleShareOpportunity = useCallback((opportunity: Opportunity) => {
    // Share functionality - can be enhanced later
    router.push(`/opportunity/${opportunity.id}`);
  }, [router]);

  // Render swipe actions (left side when swiping right)
  const renderLeftActions = useCallback((opportunity: Opportunity) => {
    const isSaved = savedOpportunityIds.includes(opportunity.id);
    const swipeableRef = swipeableRefs.current.get(opportunity.id);
    
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={[styles.swipeAction, styles.saveAction, { backgroundColor: isSaved ? '#F59E0B' : '#38B6FF' }]}
          onPress={() => {
            handleToggleSave(opportunity);
            swipeableRef?.close();
          }}
          activeOpacity={0.8}
        >
          <Bookmark 
            size={24} 
            color="#FFFFFF" 
            fill={isSaved ? "#FFFFFF" : "none"}
          />
          <Text style={styles.swipeActionText}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.shareAction, { backgroundColor: '#10B981' }]}
          onPress={() => {
            handleShareOpportunity(opportunity);
            swipeableRef?.close();
          }}
          activeOpacity={0.8}
        >
          <Share2 size={24} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>Share</Text>
        </TouchableOpacity>
      </View>
    );
  }, [savedOpportunityIds, handleToggleSave, handleShareOpportunity]);

  // Improved debounced search (300ms instead of 700ms)
  const handleSearchChange = useCallback((text: string) => {
    setSearchInputValue(text);
    setShowSuggestions(true);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(text);
      if (text.trim()) {
        saveSearchToHistory(text.trim());
        loadSearchHistory();
      }
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchInputValue('');
    setSearchQuery('');
    setShowSuggestions(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setSearchInputValue(suggestion);
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    saveSearchToHistory(suggestion);
    loadSearchHistory();
    // Don't dismiss keyboard immediately - let user continue typing if needed
    // Keyboard will dismiss when they tap outside or press Enter
  }, []);

  const handleSelectHistory = useCallback((history: string) => {
    setSearchInputValue(history);
    setSearchQuery(history);
    setShowSuggestions(false);
    // Refocus input to keep keyboard open
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const handleFocus = useCallback(() => {
    setShowSuggestions(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Don't auto-hide suggestions on blur - let user tap suggestions
    // Suggestions will hide when user selects one or taps outside
  }, []);

  const handleHideSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  // Phase 2: Optimistic category selection handler
  const handleSelectCategoryOptimistic = useCallback((category: string) => {
    // Show results immediately without loading spinner
    setSelectedCategory(category as any);
    setSelectedQuickFilter(null); // Clear quick filter when category changes

    // For "Near Me", show all opportunities initially - distance will be calculated by loadOpportunities
    // The filteredOpportunities useMemo will handle the actual filtering once distances are available
    if (category === 'nearMe') {
      // Don't filter here - let loadOpportunities calculate distances first
      // The useMemo will filter once distances are available
    } else {
      // For other categories, apply local filter immediately
      const optimisticFiltered = opportunities.filter(opp => {
        if (category === 'all') return true;
        return opp.category === category;
      });
      // Note: filteredOpportunities will be recalculated by useMemo, but this provides instant feedback
    }

    // Fetch fresh data silently in background (don't show loading)
    loadOpportunities();
  }, [opportunities]);

  const handleSelectCategory = useCallback((category: string) => {
    handleSelectCategoryOptimistic(category);
  }, [handleSelectCategoryOptimistic]);

  // Phase 2: Optimistic filter handler
  const handleApplyFiltersOptimistic = useCallback(() => {
    // Apply all current filters to local opportunities
    let filtered = [...opportunities];

    // Date range filtering
    if (dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(opp => {
        const oppDate = opp.dateEnd 
          ? new Date(opp.dateEnd)
          : opp.date 
          ? new Date(opp.date)
          : null;
        
        if (!oppDate) return true;
        
        if (dateRange === 'today') {
          return oppDate.toDateString() === today.toDateString();
        } else if (dateRange === 'thisWeek') {
          const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          return oppDate >= today && oppDate <= weekLater;
        } else if (dateRange === 'thisMonth') {
          const monthFromNow = new Date(today);
          monthFromNow.setMonth(monthFromNow.getMonth() + 1);
          return oppDate >= today && oppDate <= monthFromNow;
        } else if (dateRange === 'upcoming') {
          return oppDate >= today;
        }
        return true;
      });
    }

    // Distance filtering
    if (maxDistance !== undefined) {
      filtered = filtered.filter(opp => 
        opp.distance !== undefined && opp.distance <= maxDistance
      );
    }

    // Spots available filtering
    if (minSpotsAvailable !== undefined) {
      filtered = filtered.filter(opp => 
        opp.spotsAvailable >= minSpotsAvailable
      );
    }

    // Organization verified filtering
    if (organizationVerified !== undefined) {
      filtered = filtered.filter(opp => 
        opp.organizationVerified === organizationVerified
      );
    }

    // Fetch fresh data silently in background
    loadOpportunities();
  }, [opportunities, dateRange, maxDistance, minSpotsAvailable, organizationVerified]);

  // Phase 4: Quick filter handler
  const handleSelectQuickFilter = useCallback(async (filterId: string) => {
    if (selectedQuickFilter === filterId) {
      // Deselect if already selected
      setSelectedQuickFilter(null);
      return;
    }

    setSelectedQuickFilter(filterId);
    setSelectedCategory('all'); // Reset category when using quick filter

    // Load saved IDs if selecting saved filter
    if (filterId === 'saved') {
      await loadSavedOpportunityIds();
    }
  }, [selectedQuickFilter, loadSavedOpportunityIds]);

  // Load more opportunities (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !searchQuery.trim()) {
      loadOpportunities(true);
    }
  }, [loadingMore, hasMore, searchQuery]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadOpportunities();
    }, [])
  );

  const renderHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      {/* Search Bar - Only show when expanded */}
      {isSearchExpanded && (
        <View style={styles.searchBarContainer}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <SearchBar
              searchQuery={searchInputValue}
              onSearchChange={handleSearchChange}
              onClearSearch={() => {
                handleClearSearch();
                // Close search if cleared and empty
                if (!searchInputValue.trim()) {
                  setIsSearchExpanded(false);
                  Keyboard.dismiss();
                }
              }}
              searchInputRef={searchInputRef}
              colors={colors}
              onFocus={handleFocus}
              onBlur={() => {
                handleBlur();
                // Close search on blur if empty
                if (!searchInputValue.trim() && !showSuggestions) {
                  setIsSearchExpanded(false);
                }
              }}
              onHideSuggestions={handleHideSuggestions}
              searchBarRef={searchBarRef as React.RefObject<View | null>}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                setSearchBarLayout({ y, height });
              }}
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              setIsSearchExpanded(false);
              setShowSuggestions(false);
              Keyboard.dismiss();
            }}
            style={[styles.closeSearchButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityLabel="Close search"
            activeOpacity={0.7}
          >
            <X size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Search Info Bar */}
      {searchQuery.trim() && (
        <View style={[styles.searchInfoBar, { backgroundColor: colors.background }]}>
          <Text style={[styles.searchInfoText, { color: colors.textSecondary }]}>
            {filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'opportunity' : 'opportunities'} found
            {searchQuery && ` for "${searchQuery}"`}
          </Text>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <SlidersHorizontal size={16} color={colors.textSecondary} />
            <Text style={[styles.filterButtonText, { color: colors.textSecondary }]}>Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Panel */}
      <FilterPanel
        visible={showFilters}
        onClose={() => {
          handleApplyFiltersOptimistic();
          setShowFilters(false);
        }}
        colors={colors}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        maxDistance={maxDistance}
        onMaxDistanceChange={setMaxDistance}
        minSpotsAvailable={minSpotsAvailable}
        onMinSpotsAvailableChange={setMinSpotsAvailable}
        organizationVerified={organizationVerified}
        onOrganizationVerifiedChange={setOrganizationVerified}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {/* Phase 4: Quick Filters */}
      <QuickFilters
        onSelectFilter={handleSelectQuickFilter}
        selectedFilter={selectedQuickFilter}
        colors={colors}
        trendingCount={opportunities.length > 0 ? Math.min(opportunities.length, 12) : 0}
        fillingCount={opportunities.filter(o => {
          const spots = o.spotsAvailable;
          return spots > 0 && spots <= 5;
        }).length}
        savedCount={savedOpportunityIds.length}
      />

      {/* Category Filter */}
      <FlatList
        ref={categoryScrollRef}
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              { backgroundColor: colors.background, borderColor: colors.border },
              selectedCategory === item.value && {
                backgroundColor: colors.tint,
                borderColor: colors.tint,
              },
            ]}
            onPress={() => handleSelectCategory(item.value)}
          >
            <Text
              style={[
                styles.categoryChipText,
                { color: colors.textSecondary },
                selectedCategory === item.value && styles.categoryChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.categoriesContainer}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  ), [
    colors,
    searchInputValue,
    selectedCategory,
    handleSearchChange,
    handleClearSearch,
    suggestions,
    searchHistory,
    handleSelectSuggestion,
    handleSelectHistory,
    showSuggestions,
    showFilters,
    dateRange,
    maxDistance,
    minSpotsAvailable,
    organizationVerified,
    sortBy,
    searchQuery,
    filteredOpportunities.length,
    selectedQuickFilter,
    handleSelectQuickFilter,
    handleSelectCategory,
    handleApplyFiltersOptimistic,
    opportunities,
  ]);

  const renderEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.listContent}>
          <OpportunitiesSkeleton count={4} />
        </View>
      );
    }

    if (error) {
      return (
        <EmptyState
          icon={X}
          title="Error loading opportunities"
          subtitle={error}
          action={{
            label: 'Retry',
            onPress: () => loadOpportunities(),
          }}
          colors={colors}
        />
      );
    }

    // Phase 3: Empty state 1: Search with no results
    if (searchQuery.trim() && filteredOpportunities.length === 0) {
      return (
        <EmptyState
          icon={Search}
          title="No results for that search"
          subtitle={`We couldn't find opportunities matching "${searchQuery}"`}
          action={{
            label: 'Clear Search',
            onPress: () => {
              setSearchQuery('');
              setSearchInputValue('');
              setSelectedQuickFilter(null);
            },
          }}
          suggestions={[
            'Try different keywords',
            `Browse ${selectedCategory === 'all' ? 'all' : selectedCategory} opportunities`,
            'Adjust your distance filter',
          ]}
          colors={colors}
        />
      );
    }

    // Phase 3: Empty state 2: Category with no results
    if (selectedCategory !== 'all' && filteredOpportunities.length === 0) {
      return (
        <EmptyState
          icon={Filter}
          title="No opportunities in this category"
          subtitle={`There are no ${selectedCategory} opportunities right now`}
          action={{
            label: 'View All Opportunities',
            onPress: () => handleSelectCategory('all'),
          }}
          suggestions={[
            'Check back later',
            'Try a different category',
            'Browse all opportunities',
          ]}
          colors={colors}
        />
      );
    }

    // Phase 3: Empty state 3: Quick filter with no results
    if (selectedQuickFilter && filteredOpportunities.length === 0) {
      const filterLabel = QUICK_FILTERS.find(f => f.id === selectedQuickFilter)?.label || 'selected filter';
      return (
        <EmptyState
          icon={selectedQuickFilter === 'saved' ? Bookmark : selectedQuickFilter === 'trending' ? TrendingUp : Zap}
          title={`No ${filterLabel} opportunities`}
          subtitle={`There are no opportunities matching your ${filterLabel.toLowerCase()} filter right now`}
          action={{
            label: 'View All Opportunities',
            onPress: () => {
              setSelectedQuickFilter(null);
              handleSelectCategory('all');
            },
          }}
          suggestions={[
            'Try a different filter',
            'Browse all opportunities',
            'Check back later',
          ]}
          colors={colors}
        />
      );
    }

    // Phase 3: Empty state 4: First launch or no opportunities exist
    return (
      <EmptyState
        icon={Lightbulb}
        title="Discover volunteer opportunities"
        subtitle="Browse and find opportunities that match your interests"
        action={{
          label: 'Browse Categories',
          onPress: () => handleSelectCategory('all'),
        }}
        suggestions={[
          'Use search to find specific opportunities',
          'Filter by location or date',
          'Check back often for new opportunities',
        ]}
        colors={colors}
      />
    );
  }, [loading, error, colors, searchQuery, selectedCategory, selectedQuickFilter, filteredOpportunities.length, handleSelectCategory]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable 
        style={[styles.container, { backgroundColor: colors.card }]}
        onPress={() => {
          // Hide suggestions when tapping outside search area
          if (showSuggestions) {
            setShowSuggestions(false);
            Keyboard.dismiss();
          }
        }}
      >
        <Head>
          <title>Discover | VIbe</title>
        </Head>
        {/* Header with SafeAreaInsets */}
        {!isDesktop && (
          <View style={[
            styles.header,
            { paddingTop: insets.top + 16, backgroundColor: colors.background, borderBottomColor: colors.border }
          ]}>
            <View style={styles.headerContent}>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  Find volunteer opportunities
                </Text>
              </View>
            </View>
          </View>
        )}

        <WebContainer>
          {/* Tab Bar */}
          <TabBar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              // Mark tab as cached when first accessed
              setTabCache(prev => ({
                ...prev,
                [tab]: true,
              }));
            }}
            colors={colors}
          />

          {/* Tab Content - All tabs are rendered but hidden when inactive for caching */}
          <View style={[styles.tabContent, activeTab !== 'opportunities' && styles.tabContentHidden]}>
          {/* Location Banner */}
          {selectedCategory === 'nearMe' && !locationPermission && !requestingLocation && (
            <View style={[styles.locationBanner, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
              <Text style={[styles.locationBannerText, { color: colors.warning }]}>
                📍 Enable location to see nearby opportunities
              </Text>
              <TouchableOpacity 
                onPress={getUserLocation}
                style={[styles.enableLocationButton, { backgroundColor: colors.warning }]}
              >
                <Text style={styles.enableLocationButtonText}>Enable</Text>
              </TouchableOpacity>
            </View>
          )}
          {selectedCategory === 'nearMe' && requestingLocation && (
            <View style={[styles.locationBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.tint} />
              <Text style={[styles.locationBannerText, { color: colors.text }]}>Getting your location...</Text>
            </View>
          )}

          {/* Search Header - Always render (contains filters/categories), search bar only shows when expanded */}
          <View style={styles.searchHeaderContainer}>
            {renderHeader()}
          </View>

          {/* Suggestions Dropdown - Rendered outside FlatList for proper z-index */}
          <SuggestionsDropdown
            visible={showSuggestions}
            suggestions={suggestions}
            searchHistory={[]}
            searchQuery={searchInputValue}
            colors={colors}
            onSelectSuggestion={handleSelectSuggestion}
            onSelectHistory={handleSelectHistory}
            onClose={handleHideSuggestions}
            topPosition={searchBarLayout.y + searchBarLayout.height + 4}
          />

          {/* Opportunities List */}
          <FlatList
            ref={listRef}
            data={filteredOpportunities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable
                ref={(ref) => {
                  if (ref) {
                    swipeableRefs.current.set(item.id, ref);
                  } else {
                    swipeableRefs.current.delete(item.id);
                  }
                }}
                renderLeftActions={() => renderLeftActions(item)}
                overshootLeft={false}
                friction={2}
              >
                <OpportunityCard opportunity={item} onPress={handleOpportunityPress} />
              </Swipeable>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading && !loadingMore}
                onRefresh={() => loadOpportunities()}
                tintColor={colors.tint}
              />
            }
            ListEmptyComponent={renderEmptyComponent}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>Loading more...</Text>
                </View>
              ) : null
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={activeTab === 'opportunities'}
          />
        </View>

        <View style={[styles.tabContent, activeTab !== 'causes' && styles.tabContentHidden]}>
          <CausesList 
            showSearch={false}
            showFilters={true}
            onCausePress={(cause) => router.push(`/causes/${cause.id}`)}
          />
        </View>

        <View style={[styles.tabContent, activeTab !== 'events' && styles.tabContentHidden]}>
          <EventsList 
            showSearch={false}
            showFilters={true}
          />
        </View>
        </WebContainer>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: isSmallScreen ? 20 : isLargeScreen ? 26 : 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  searchIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerContainer: {
    paddingBottom: 16,
  },
  searchHeaderContainer: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 10 : 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 16,
  },
  suggestionsDropdownWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  suggestionsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    overflow: 'hidden',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
    gap: 6,
  },
  suggestionsHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  suggestionsDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
  },
  searchInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  searchInfoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 8,
    minHeight: 44,
    borderWidth: 1,
    gap: 6,
  },
  filterButtonText: {
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600',
  },
  filterPanel: {
    marginBottom: 16,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 6 : 8,
    borderRadius: 20,
    minHeight: 44,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingRight: isSmallScreen ? 12 : 16,
    paddingLeft: isSmallScreen ? 12 : 16,
  },
  categoryChip: {
    paddingHorizontal: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 3 : 4,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clearFiltersButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  locationBanner: {
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  locationBannerText: {
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  enableLocationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enableLocationButtonText: {
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
  quickFiltersContainer: {
    height: 44,
    marginBottom: 12,
  },
  quickFiltersContent: {
    gap: 8,
  },
  quickFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
  },
  quickFilterPillText: {
    fontWeight: '600',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontWeight: 'bold',
  },
  tabBar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  tabBarContent: {
    paddingHorizontal: isSmallScreen ? 12 : 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingVertical: isSmallScreen ? 8 : 10,
    borderRadius: 20,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
  },
  tabContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 16,
    height: '100%',
  },
  swipeAction: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginRight: 8,
  },
  saveAction: {
    // Color set dynamically
  },
  shareAction: {
    // Color set dynamically
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  tabContent: {
    flex: 1,
  },
  tabContentHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
  },
});
 