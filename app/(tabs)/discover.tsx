/**
 * Discover Tab Screen
 * Browse and search volunteer opportunities with advanced search features
 * 
 * Modern UI with:
 * - Responsive design (mobile app, mobile web, desktop)
 * - Animated tab bar with sliding indicator
 * - Enhanced search with focus states
 * - Animated filter chips
 * - Polished suggestions dropdown
 * - Shimmer loading states
 * - Micro-interactions throughout
 * - Full theme integration
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
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Search, X, MapPin, Filter, ChevronDown, Clock, Users, CheckCircle, 
  SlidersHorizontal, TrendingUp, Zap, Bookmark, Lightbulb, Share2, Check 
} from 'lucide-react-native';
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================
const getResponsiveValues = () => {
  const width = Dimensions.get('window').width;
  
  const isSmallMobile = width < 380;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  return {
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    maxContentWidth: isDesktop ? 1200 : isTablet ? 900 : '100%',
    numColumns: isDesktop ? 3 : isTablet ? 2 : 1,
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
      xxl: isSmallMobile ? 24 : 32,
    },
    fontSize: {
      xs: isSmallMobile ? 11 : 12,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 16 : 17,
      xl: isSmallMobile ? 18 : 20,
      xxl: isSmallMobile ? 22 : 26,
      title: isSmallMobile ? 20 : isTablet ? 28 : 26,
    },
    headerHeight: isSmallMobile ? 56 : 64,
    chipHeight: isSmallMobile ? 36 : 40,
    searchHeight: isSmallMobile ? 44 : 48,
  };
};

// ============================================================================
// CONSTANTS
// ============================================================================
const CATEGORIES: { value: OpportunityCategory | 'all' | 'nearMe'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nearMe', label: 'Near Me' },
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'poorRelief', label: 'Poor Relief' },
  { value: 'community', label: 'Community' },
  { value: 'viEngage', label: 'VI Engage' },
];

const QUICK_FILTERS = [
  { id: 'trending', label: 'Trending', icon: TrendingUp, description: 'Most popular this week' },
  { id: 'filling', label: 'Filling Fast', icon: Zap, description: 'Spots filling up' },
  { id: 'saved', label: 'Saved', icon: Bookmark, description: 'Your bookmarks' },
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

// ============================================================================
// SHIMMER SKELETON COMPONENT
// ============================================================================
function ShimmerEffect({ style, colors }: { style?: any; colors: typeof Colors.light }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[{ backgroundColor: colors.skeleton, opacity }, style]}
    />
  );
}

// ============================================================================
// ANIMATED TAB BAR COMPONENT
// ============================================================================
const AnimatedTabBar = React.memo(({
  activeTab,
  onTabChange,
  colors,
}: {
  activeTab: 'opportunities' | 'causes' | 'events';
  onTabChange: (tab: 'opportunities' | 'causes' | 'events') => void;
  colors: typeof Colors.light;
}) => {
  const tabs = [
    { id: 'opportunities' as const, label: 'Opportunities' },
    { id: 'causes' as const, label: 'Causes' },
    { id: 'events' as const, label: 'Events' },
  ];

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [tabWidths, setTabWidths] = useState<number[]>([]);
  const [tabPositions, setTabPositions] = useState<number[]>([]);
  const responsive = getResponsiveValues();

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  useEffect(() => {
    if (tabPositions.length > 0 && tabWidths.length > 0) {
      Animated.spring(slideAnim, {
        toValue: tabPositions[activeIndex] || 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, tabPositions, tabWidths]);

  const handleTabLayout = (index: number, event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setTabWidths(prev => {
      const newWidths = [...prev];
      newWidths[index] = width;
      return newWidths;
    });
    setTabPositions(prev => {
      const newPositions = [...prev];
      newPositions[index] = x;
      return newPositions;
    });
  };

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabWidths.length === tabs.length && (
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                backgroundColor: colors.primary,
                width: tabWidths[activeIndex] || 100,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        )}

        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onLayout={(e) => handleTabLayout(index, e)}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
              onPress={() => onTabChange(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.textOnPrimary : colors.textSecondary, fontSize: responsive.fontSize.md },
                  isActive && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

// ============================================================================
// ENHANCED SEARCH BAR COMPONENT
// ============================================================================
const EnhancedSearchBar = React.memo(({ 
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
  colors: typeof Colors.light;
  onFocus: () => void;
  onBlur: () => void;
  onHideSuggestions: () => void;
  onLayout?: (event: any) => void;
  searchBarRef?: React.RefObject<View | null>;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const responsive = getResponsiveValues();

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const handleFocus = () => {
    setIsFocused(true);
    onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur();
  };

  return (
    <View ref={searchBarRef as any} onLayout={onLayout} style={styles.searchWrapper}>
      <Animated.View 
        style={[
          styles.searchContainer, 
          { 
            backgroundColor: colors.card, 
            borderColor,
            borderWidth: isFocused ? 2 : 1,
            height: responsive.searchHeight,
          }
        ]}
      >
        <Search 
          size={20} 
          color={isFocused ? colors.primary : colors.textSecondary} 
          style={styles.searchIcon} 
        />
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { color: colors.text, fontSize: responsive.fontSize.md }]}
          placeholder="Search opportunities..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={onSearchChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
        />
        {searchQuery.length > 0 && (
          <Pressable 
            onPress={onClearSearch}
            style={({ pressed }) => [
              styles.clearButton,
              { backgroundColor: colors.surfaceElevated },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
          >
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
});

// ============================================================================
// ANIMATED SUGGESTIONS DROPDOWN
// ============================================================================
const SuggestionsDropdown = React.memo(({
  visible,
  suggestions,
  colors,
  onSelectSuggestion,
  topPosition,
}: {
  visible: boolean;
  suggestions: string[];
  colors: typeof Colors.light;
  onSelectSuggestion: (suggestion: string) => void;
  topPosition: number;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  const showDropdown = visible && suggestions.length > 0;

  useEffect(() => {
    if (showDropdown) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [showDropdown]);

  if (!showDropdown) return null;

  return (
    <Animated.View 
      style={[
        styles.suggestionsDropdownWrapper, 
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          top: topPosition,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          shadowColor: colors.shadow,
        }
      ]}
    >
      <View style={styles.suggestionsContainer}>
        <View style={[styles.suggestionsHeader, { borderBottomColor: colors.divider }]}>
          <Search size={14} color={colors.primary} />
          <Text style={[styles.suggestionsHeaderText, { color: colors.textSecondary }]}>Suggestions</Text>
        </View>
        {suggestions.map((suggestion, index) => (
          <Pressable
            key={`suggestion-${index}`}
            style={({ pressed }) => [
              styles.suggestionItem,
              { borderBottomColor: colors.divider },
              pressed && { backgroundColor: colors.surfacePressed },
              index === suggestions.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => onSelectSuggestion(suggestion)}
          >
            <View style={[styles.suggestionIconContainer, { backgroundColor: colors.primarySoft }]}>
              <Search size={14} color={colors.primary} />
            </View>
            <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
});

// ============================================================================
// ANIMATED FILTER CHIP COMPONENT
// ============================================================================
const AnimatedFilterChip = React.memo(({
  label,
  isSelected,
  onPress,
  colors,
  icon: Icon,
  count,
  showMapPin,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
  icon?: any;
  count?: number;
  showMapPin?: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const responsive = getResponsiveValues();

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
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[styles.filterChip, { backgroundColor, borderColor, height: responsive.chipHeight }]}
        >
          {isSelected && (
            <View style={styles.chipCheckmark}>
              <Check size={12} color={colors.textOnPrimary} strokeWidth={3} />
            </View>
          )}
          {showMapPin && <MapPin size={14} color={isSelected ? colors.textOnPrimary : colors.text} style={{ marginRight: 4 }} />}
          {Icon && <Icon size={14} color={isSelected ? colors.textOnPrimary : colors.text} style={{ marginRight: 4 }} />}
          <Text style={[styles.filterChipText, { color: isSelected ? colors.textOnPrimary : colors.text }, isSelected && styles.filterChipTextSelected]}>
            {label}
          </Text>
          {count !== undefined && count > 0 && (
            <View style={[styles.filterChipBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.primary }]}>
              <Text style={[styles.filterChipBadgeText, { color: colors.textOnPrimary }]}>{count}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================================
// FILTER PANEL COMPONENT
// ============================================================================
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
  colors: typeof Colors.light;
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
    <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.filterPanelHeader}>
        <View style={styles.filterPanelTitleContainer}>
          <SlidersHorizontal size={18} color={colors.primary} />
          <Text style={[styles.filterPanelTitle, { color: colors.text }]}>Filters</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.filterCloseButton, { backgroundColor: colors.surfaceElevated }, pressed && { opacity: 0.7 }]}
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
          <View style={styles.filterOptions}>
            {SORT_OPTIONS.map(option => (
              <AnimatedFilterChip key={option.value} label={option.label} isSelected={sortBy === option.value} onPress={() => onSortByChange(option.value)} colors={colors} />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Date Range</Text>
          <View style={styles.filterOptions}>
            {DATE_RANGE_OPTIONS.map(option => (
              <AnimatedFilterChip key={option.value} label={option.label} isSelected={dateRange === option.value} onPress={() => onDateRangeChange(option.value)} colors={colors} />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Maximum Distance</Text>
          <View style={styles.filterOptions}>
            {[5, 10, 25, 50, 100].map(distance => (
              <AnimatedFilterChip key={distance} label={`${distance} mi`} isSelected={maxDistance === distance} onPress={() => onMaxDistanceChange(maxDistance === distance ? undefined : distance)} colors={colors} />
            ))}
            <AnimatedFilterChip label="Any" isSelected={maxDistance === undefined} onPress={() => onMaxDistanceChange(undefined)} colors={colors} />
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Minimum Spots</Text>
          <View style={styles.filterOptions}>
            {[1, 5, 10, 20].map(spots => (
              <AnimatedFilterChip key={spots} label={`${spots}+`} isSelected={minSpotsAvailable === spots} onPress={() => onMinSpotsAvailableChange(minSpotsAvailable === spots ? undefined : spots)} colors={colors} />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Organization</Text>
          <View style={styles.filterOptions}>
            <AnimatedFilterChip label="Verified Only" isSelected={organizationVerified === true} onPress={() => onOrganizationVerifiedChange(organizationVerified === true ? undefined : true)} colors={colors} icon={CheckCircle} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

// ============================================================================
// LOCATION BANNER COMPONENT
// ============================================================================
const LocationBanner = React.memo(({ type, colors, onEnable }: { type: 'permission' | 'loading'; colors: typeof Colors.light; onEnable?: () => void }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (type === 'loading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [type]);

  if (type === 'loading') {
    return (
      <View style={[styles.locationBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MapPin size={18} color={colors.primary} />
        </Animated.View>
        <Text style={[styles.locationBannerText, { color: colors.text }]}>Getting your location...</Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.locationBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
      <MapPin size={18} color={colors.warning} />
      <Text style={[styles.locationBannerText, { color: colors.warningText }]}>Enable location to see nearby opportunities</Text>
      <Pressable onPress={onEnable} style={({ pressed }) => [styles.enableLocationButton, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
        <LinearGradient colors={[colors.warning, colors.warningDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enableLocationGradient}>
          <Text style={[styles.enableLocationButtonText, { color: colors.textOnPrimary }]}>Enable</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
});

// ============================================================================
// SWIPE ACTION COMPONENT
// ============================================================================
const SwipeActions = React.memo(({ isSaved, onSave, onShare, colors }: { isSaved: boolean; onSave: () => void; onShare: () => void; colors: typeof Colors.light }) => (
  <View style={styles.swipeActionsContainer}>
    <Pressable style={({ pressed }) => [styles.swipeAction, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} onPress={onSave}>
      <LinearGradient colors={isSaved ? [colors.warning, colors.warningDark] : [colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.swipeActionGradient}>
        <Bookmark size={24} color={colors.textOnPrimary} fill={isSaved ? colors.textOnPrimary : "none"} />
        <Text style={[styles.swipeActionText, { color: colors.textOnPrimary }]}>{isSaved ? 'Saved' : 'Save'}</Text>
      </LinearGradient>
    </Pressable>
    <Pressable style={({ pressed }) => [styles.swipeAction, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} onPress={onShare}>
      <LinearGradient colors={[colors.success, colors.successDark]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.swipeActionGradient}>
        <Share2 size={24} color={colors.textOnPrimary} />
        <Text style={[styles.swipeActionText, { color: colors.textOnPrimary }]}>Share</Text>
      </LinearGradient>
    </Pressable>
  </View>
));

// ============================================================================
// HEADER COMPONENT
// ============================================================================
const ScreenHeader = React.memo(({ colors, insets, onSearchPress }: { colors: typeof Colors.light; insets: { top: number }; onSearchPress: () => void }) => {
  const responsive = getResponsiveValues();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => { Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start(); };
  const handlePressOut = () => { Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start(); };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: responsive.fontSize.title }]}>Discover</Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable onPress={onSearchPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.searchIconButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Search size={22} color={colors.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
});

// ============================================================================
// LOADING FOOTER
// ============================================================================
const LoadingFooter = React.memo(({ colors }: { colors: typeof Colors.light }) => (
  <View style={styles.loadingMoreContainer}>
    <View style={[styles.loadingMoreContent, { backgroundColor: colors.surfaceElevated }]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>Loading more...</Text>
    </View>
  </View>
));

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function DiscoverScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const responsive = getResponsiveValues();
  const isDesktop = Platform.OS === 'web' && width >= 992;
  const { isAdmin, user } = useAuth();
  
  const searchInputRef = useRef<TextInput | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  
  const [searchBarLayout, setSearchBarLayout] = useState({ y: 0, height: 0 });
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<OpportunityCategory | 'all' | 'nearMe'>((params.category as any) || 'all');
  const [searchQuery, setSearchQuery] = useState((params.query as string) || '');
  const [searchInputValue, setSearchInputValue] = useState((params.query as string) || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<string[]>([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'opportunities' | 'causes' | 'events'>('opportunities');
  const [tabCache, setTabCache] = useState({ opportunities: true, causes: false, events: false });
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<string>('all');
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined);
  const [minSpotsAvailable, setMinSpotsAvailable] = useState<number | undefined>(undefined);
  const [organizationVerified, setOrganizationVerified] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  // Load search history
  const loadSearchHistory = async () => { setSearchHistory(await getSearchHistory()); };
  useEffect(() => { loadSearchHistory(); }, []);

  // Load saved opportunity IDs
  const loadSavedOpportunityIds = useCallback(async () => {
    if (!user?.id) { setSavedOpportunityIds([]); return; }
    try {
      const { data, error } = await supabase.from('saved_opportunities').select('opportunity_id').eq('user_id', user.id);
      if (error) throw error;
      setSavedOpportunityIds(data?.map(item => item.opportunity_id) || []);
    } catch (error) { console.error('Error loading saved opportunities:', error); setSavedOpportunityIds([]); }
  }, [user?.id]);

  useEffect(() => { user?.id ? loadSavedOpportunityIds() : setSavedOpportunityIds([]); }, [user?.id, loadSavedOpportunityIds]);

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Get user location
  const getUserLocation = async () => {
    try {
      setRequestingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationPermission(false); setRequestingLocation(false); return; }
      setLocationPermission(true);
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (error) { console.error('Error getting location:', error); setLocationPermission(false); } 
    finally { setRequestingLocation(false); }
  };

  useEffect(() => { if (selectedCategory === 'nearMe' && !userLocation && !requestingLocation) getUserLocation(); }, [selectedCategory]);

  // Load opportunities
  const loadOpportunities = async (append: boolean = false) => {
    try {
      if (!append) { setLoading(true); setError(null); } else { setLoadingMore(true); }

      let isPremiumMember = false, isAdminUser = false;
      if (user?.id) {
        const { data: userData } = await supabase.from('users').select('membership_tier, membership_status, role').eq('id', user.id).single();
        isPremiumMember = userData?.membership_tier === 'premium' && userData?.membership_status === 'active';
        isAdminUser = userData?.role === 'admin';
      }

      let query = supabase.from('opportunities').select('*').eq('status', 'active').or('proposal_status.is.null,proposal_status.eq.approved');
      if (!isAdminUser && !isPremiumMember) query = query.or('visibility.is.null,visibility.eq.public');
      if (selectedCategory !== 'all' && selectedCategory !== 'nearMe') query = query.eq('category', selectedCategory);
      query = query.order('date', { ascending: true });
      if (append) query = query.range(opportunities.length, opportunities.length + PAGE_SIZE - 1);
      else query = query.limit(PAGE_SIZE);

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      const opportunitiesData: Opportunity[] = (data || []).map((opp) => ({
        id: opp.id,
        slug: opp.slug,
        title: opp.title, description: opp.description, organizationName: opp.organization_name,
        organizationVerified: opp.organization_verified, category: opp.category, location: opp.location,
        latitude: opp.latitude, longitude: opp.longitude, mapLink: opp.map_link, date: opp.date,
        dateStart: opp.date_start, dateEnd: opp.date_end, timeStart: opp.time_start, timeEnd: opp.time_end,
        duration: opp.duration, spotsAvailable: opp.spots_available, spotsTotal: opp.spots_total,
        requirements: opp.requirements, skillsNeeded: opp.skills_needed, impactStatement: opp.impact_statement,
        imageUrl: opp.image_url, status: opp.status, visibility: opp.visibility || 'public',
        createdBy: opp.created_by, createdAt: opp.created_at, updatedAt: opp.updated_at,
        distance: userLocation && opp.latitude && opp.longitude ? calculateDistance(userLocation.latitude, userLocation.longitude, opp.latitude, opp.longitude) : undefined,
      }));

      const today = new Date(); today.setHours(0, 0, 0, 0);
      let filteredData = isAdminUser ? opportunitiesData : opportunitiesData.filter((opp) => {
        const oppDate = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null;
        if (!oppDate) return true;
        const oppDateEnd = new Date(oppDate); oppDateEnd.setHours(23, 59, 59, 999);
        return oppDateEnd >= today;
      });

      if (append) { setOpportunities(prev => [...prev, ...filteredData]); setHasMore(filteredData.length === PAGE_SIZE); }
      else { setOpportunities(filteredData); setHasMore(filteredData.length === PAGE_SIZE); }
    } catch (error: any) { console.error('Error loading opportunities:', error); setError(error.message || 'Failed to load opportunities'); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { loadOpportunities(); }, [selectedCategory]);
  useEffect(() => { if (userLocation) loadOpportunities(); }, [userLocation]);

  // Filtered opportunities
  const filteredOpportunities = useMemo(() => {
    if (opportunities.length === 0) return [];
    let results = [...opportunities];

    if (selectedQuickFilter === 'trending') results.sort((a, b) => ((b.spotsTotal - b.spotsAvailable) || 0) - ((a.spotsTotal - a.spotsAvailable) || 0));
    else if (selectedQuickFilter === 'filling') results = results.filter(opp => opp.spotsAvailable > 0 && opp.spotsAvailable <= 5).sort((a, b) => a.spotsAvailable - b.spotsAvailable);
    else if (selectedQuickFilter === 'saved') results = results.filter(opp => savedOpportunityIds.includes(opp.id));

    if (dateRange !== 'all') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (dateRange === 'today') results = results.filter(opp => { const d = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null; if (!d) return false; const dd = new Date(d); dd.setHours(0,0,0,0); return dd.getTime() === today.getTime(); });
      else if (dateRange === 'thisWeek') { const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7); results = results.filter(opp => { const d = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null; return d && new Date(d) >= today && new Date(d) <= weekEnd; }); }
      else if (dateRange === 'thisMonth') { const monthEnd = new Date(today); monthEnd.setMonth(monthEnd.getMonth() + 1); results = results.filter(opp => { const d = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null; return d && new Date(d) >= today && new Date(d) <= monthEnd; }); }
    }

    if (minSpotsAvailable !== undefined) results = results.filter(opp => opp.spotsAvailable >= minSpotsAvailable);
    if (organizationVerified !== undefined) results = results.filter(opp => opp.organizationVerified === organizationVerified);
    if (maxDistance !== undefined && userLocation) results = results.filter(opp => opp.distance !== undefined && opp.distance <= maxDistance);

    if (sortBy === 'date') results.sort((a, b) => (a.dateEnd ? new Date(a.dateEnd) : a.date ? new Date(a.date) : new Date(0)).getTime() - (b.dateEnd ? new Date(b.dateEnd) : b.date ? new Date(b.date) : new Date(0)).getTime());
    else if (sortBy === 'spots') results.sort((a, b) => b.spotsAvailable - a.spotsAvailable);
    else if (sortBy === 'distance' && userLocation) results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    if (selectedCategory === 'nearMe') {
      results = results.filter(opp => opp.latitude && opp.longitude);
      const hasDistances = results.some(opp => opp.distance !== undefined);
      if (hasDistances) { results = results.filter(opp => opp.distance !== undefined && opp.distance <= (maxDistance || 30)); if (sortBy !== 'distance') results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)); }
    }

    results = searchOpportunities(results, { query: searchQuery, category: selectedCategory !== 'all' && selectedCategory !== 'nearMe' ? selectedCategory : undefined, dateRange: dateRange !== 'all' ? dateRange as any : undefined, maxDistance, minSpotsAvailable, organizationVerified, sortBy: sortBy as any });
    if (searchQuery.trim()) trackSearchAnalytics(searchQuery, results.length);
    return results;
  }, [opportunities, selectedCategory, selectedQuickFilter, savedOpportunityIds, searchQuery, dateRange, maxDistance, minSpotsAvailable, organizationVerified, sortBy, userLocation]);

  const debouncedSearchQuery = useDebounce(searchInputValue, 300);
  const suggestions = useMemo(() => opportunities.length === 0 || !debouncedSearchQuery || debouncedSearchQuery.trim().length < 2 ? [] : generateSearchSuggestions(opportunities, debouncedSearchQuery, 5), [debouncedSearchQuery, opportunities]);

  // Handlers
  const handleOpportunityPress = useCallback((opportunity: Opportunity) => {
    trackSearchAnalytics(searchQuery, filteredOpportunities.length, opportunity.id);
    // Use slug if available, otherwise fallback to ID
    const identifier = opportunity.slug || opportunity.id;
    router.push(`/opportunity/${identifier}` as any);
  }, [router, searchQuery, filteredOpportunities.length]);
  const handleToggleSave = useCallback(async (opportunity: Opportunity) => {
    if (!user) return;
    const isSaved = savedOpportunityIds.includes(opportunity.id);
    try {
      if (isSaved) { const { error } = await supabase.from('saved_opportunities').delete().eq('user_id', user.id).eq('opportunity_id', opportunity.id); if (!error) setSavedOpportunityIds(prev => prev.filter(id => id !== opportunity.id)); }
      else { const { error } = await supabase.from('saved_opportunities').insert({ user_id: user.id, opportunity_id: opportunity.id }); if (!error) setSavedOpportunityIds(prev => [...prev, opportunity.id]); }
    } catch (error) { console.error('Error toggling save:', error); }
  }, [user, savedOpportunityIds]);
  const handleShareOpportunity = useCallback((opportunity: Opportunity) => { router.push(`/opportunity/${opportunity.slug}`); }, [router]);

  const renderLeftActions = useCallback((opportunity: Opportunity) => {
    const isSaved = savedOpportunityIds.includes(opportunity.id);
    const swipeableRef = swipeableRefs.current.get(opportunity.id);
    return <SwipeActions isSaved={isSaved} onSave={() => { handleToggleSave(opportunity); swipeableRef?.close(); }} onShare={() => { handleShareOpportunity(opportunity); swipeableRef?.close(); }} colors={colors} />;
  }, [savedOpportunityIds, handleToggleSave, handleShareOpportunity, colors]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchInputValue(text);
    setShowSuggestions(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => { setSearchQuery(text); if (text.trim()) { saveSearchToHistory(text.trim()); loadSearchHistory(); } }, 300);
  }, []);

  const handleClearSearch = useCallback(() => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); setSearchInputValue(''); setSearchQuery(''); setShowSuggestions(false); setTimeout(() => searchInputRef.current?.focus(), 50); }, []);
  const handleSelectSuggestion = useCallback((suggestion: string) => { setSearchInputValue(suggestion); setSearchQuery(suggestion); setShowSuggestions(false); saveSearchToHistory(suggestion); loadSearchHistory(); }, []);
  const handleSelectCategory = useCallback((category: string) => { setSelectedCategory(category as any); setSelectedQuickFilter(null); loadOpportunities(); }, []);
  const handleSelectQuickFilter = useCallback(async (filterId: string) => { if (selectedQuickFilter === filterId) { setSelectedQuickFilter(null); return; } setSelectedQuickFilter(filterId); setSelectedCategory('all'); if (filterId === 'saved') await loadSavedOpportunityIds(); }, [selectedQuickFilter, loadSavedOpportunityIds]);
  const handleApplyFilters = useCallback(() => { loadOpportunities(); }, []);
  const handleLoadMore = useCallback(() => { if (!loadingMore && hasMore && !searchQuery.trim()) loadOpportunities(true); }, [loadingMore, hasMore, searchQuery]);

  useEffect(() => { return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }; }, []);
  useFocusEffect(React.useCallback(() => { loadOpportunities(); }, []));

  const filterCounts = useMemo(() => ({
    trending: opportunities.length > 0 ? Math.min(opportunities.length, 12) : 0,
    filling: opportunities.filter(o => o.spotsAvailable > 0 && o.spotsAvailable <= 5).length,
    saved: savedOpportunityIds.length,
  }), [opportunities, savedOpportunityIds]);

  const renderHeaderContent = useCallback(() => (
    <View style={styles.headerContainer}>
      {isSearchExpanded && (
        <View style={styles.searchBarContainer}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <EnhancedSearchBar searchQuery={searchInputValue} onSearchChange={handleSearchChange} onClearSearch={() => { handleClearSearch(); if (!searchInputValue.trim()) { setIsSearchExpanded(false); Keyboard.dismiss(); } }} searchInputRef={searchInputRef} colors={colors} onFocus={() => setShowSuggestions(true)} onBlur={() => { if (!searchInputValue.trim() && !showSuggestions) setIsSearchExpanded(false); }} onHideSuggestions={() => setShowSuggestions(false)} searchBarRef={searchBarRef} onLayout={(event) => { const { y, height } = event.nativeEvent.layout; setSearchBarLayout({ y, height }); }} />
          </View>
          <Pressable onPress={() => { setIsSearchExpanded(false); setShowSuggestions(false); Keyboard.dismiss(); }} style={({ pressed }) => [styles.closeSearchButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>
      )}

      {searchQuery.trim() && (
        <View style={[styles.searchInfoBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.searchInfoText, { color: colors.textSecondary }]}>{filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'result' : 'results'}{searchQuery && ` for "${searchQuery}"`}</Text>
          <Pressable onPress={() => setShowFilters(!showFilters)} style={({ pressed }) => [styles.filterToggleButton, { backgroundColor: showFilters ? colors.primarySoft : colors.card, borderColor: showFilters ? colors.primary : colors.border }, pressed && { opacity: 0.7 }]}>
            <SlidersHorizontal size={16} color={showFilters ? colors.primary : colors.textSecondary} />
            <Text style={[styles.filterToggleText, { color: showFilters ? colors.primary : colors.textSecondary }]}>Filters</Text>
          </Pressable>
        </View>
      )}

      <FilterPanel visible={showFilters} onClose={() => { handleApplyFilters(); setShowFilters(false); }} colors={colors} dateRange={dateRange} onDateRangeChange={setDateRange} maxDistance={maxDistance} onMaxDistanceChange={setMaxDistance} minSpotsAvailable={minSpotsAvailable} onMinSpotsAvailableChange={setMinSpotsAvailable} organizationVerified={organizationVerified} onOrganizationVerifiedChange={setOrganizationVerified} sortBy={sortBy} onSortByChange={setSortBy} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
        {CATEGORIES.map((item) => <AnimatedFilterChip key={item.value} label={item.label} isSelected={selectedCategory === item.value && !selectedQuickFilter} onPress={() => { handleSelectCategory(item.value); setSelectedQuickFilter(null); }} colors={colors} showMapPin={item.value === 'nearMe'} />)}
        <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
        {QUICK_FILTERS.map((filter) => <AnimatedFilterChip key={filter.id} label={filter.label} isSelected={selectedQuickFilter === filter.id} onPress={() => { handleSelectQuickFilter(filter.id); setSelectedCategory('all'); }} colors={colors} icon={filter.icon} count={filterCounts[filter.id as keyof typeof filterCounts]} />)}
      </ScrollView>
    </View>
  ), [colors, isSearchExpanded, searchInputValue, searchQuery, showSuggestions, showFilters, selectedCategory, selectedQuickFilter, filterCounts, filteredOpportunities.length, dateRange, maxDistance, minSpotsAvailable, organizationVerified, sortBy, handleSearchChange, handleClearSearch, handleSelectCategory, handleSelectQuickFilter, handleApplyFilters]);

  const renderEmptyComponent = useCallback(() => {
    if (loading) return <View style={styles.listContent}><OpportunitiesSkeleton count={4} /></View>;
    if (error) return <EmptyState icon={X} title="Error loading opportunities" subtitle={error} action={{ label: 'Retry', onPress: () => loadOpportunities() }} colors={colors} />;
    if (searchQuery.trim() && filteredOpportunities.length === 0) return <EmptyState icon={Search} title="No results for that search" subtitle={`We couldn't find opportunities matching "${searchQuery}"`} action={{ label: 'Clear Search', onPress: () => { setSearchQuery(''); setSearchInputValue(''); setSelectedQuickFilter(null); } }} suggestions={['Try different keywords', 'Browse all opportunities']} colors={colors} />;
    if (selectedCategory !== 'all' && filteredOpportunities.length === 0) return <EmptyState icon={Filter} title="No opportunities in this category" subtitle={`There are no ${selectedCategory} opportunities right now`} action={{ label: 'View All', onPress: () => handleSelectCategory('all') }} colors={colors} />;
    if (selectedQuickFilter && filteredOpportunities.length === 0) return <EmptyState icon={selectedQuickFilter === 'saved' ? Bookmark : TrendingUp} title={`No ${QUICK_FILTERS.find(f => f.id === selectedQuickFilter)?.label || ''} opportunities`} subtitle="Try a different filter" action={{ label: 'View All', onPress: () => { setSelectedQuickFilter(null); handleSelectCategory('all'); } }} colors={colors} />;
    return <EmptyState icon={Lightbulb} title="Discover volunteer opportunities" subtitle="Browse and find opportunities that match your interests" action={{ label: 'Browse Categories', onPress: () => handleSelectCategory('all') }} colors={colors} />;
  }, [loading, error, colors, searchQuery, selectedCategory, selectedQuickFilter, filteredOpportunities.length, handleSelectCategory]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable style={[styles.container, { backgroundColor: colors.background }]} onPress={() => { if (showSuggestions) { setShowSuggestions(false); Keyboard.dismiss(); } }}>
        <Head><title>Discover | VIbe</title></Head>
        {!isDesktop && <ScreenHeader colors={colors} insets={insets} onSearchPress={() => setIsSearchExpanded(true)} />}
        <AnimatedTabBar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setTabCache(prev => ({ ...prev, [tab]: true })); }} colors={colors} />

        <View style={[styles.tabContent, activeTab !== 'opportunities' && styles.tabContentHidden]}>
          {selectedCategory === 'nearMe' && !locationPermission && !requestingLocation && <LocationBanner type="permission" colors={colors} onEnable={getUserLocation} />}
          {selectedCategory === 'nearMe' && requestingLocation && <LocationBanner type="loading" colors={colors} />}
          <View style={styles.searchHeaderContainer}>{renderHeaderContent()}</View>
          <SuggestionsDropdown visible={showSuggestions} suggestions={suggestions} colors={colors} onSelectSuggestion={handleSelectSuggestion} topPosition={searchBarLayout.y + searchBarLayout.height + 4} />
          <FlatList
            ref={listRef}
            data={filteredOpportunities}
            keyExtractor={(item) => item.id}
            numColumns={width >= 600 ? 2 : 1}
            key={width >= 600 ? '2-col' : '1-col'}
            renderItem={({ item }) => (
              <Swipeable ref={(ref) => { if (ref) swipeableRefs.current.set(item.id, ref); else swipeableRefs.current.delete(item.id); }} renderLeftActions={() => renderLeftActions(item)} overshootLeft={false} friction={2}>
                <OpportunityCard opportunity={item} onPress={handleOpportunityPress} />
              </Swipeable>
            )}
            contentContainerStyle={[
              styles.listContent,
              width >= 600 && styles.listContentGrid,
              { paddingBottom: 12 + insets.bottom },
            ]}
            columnWrapperStyle={width >= 600 ? styles.columnWrapper : undefined}
            refreshControl={<RefreshControl refreshing={loading && !loadingMore} onRefresh={() => loadOpportunities()} tintColor={colors.primary} colors={[colors.primary]} />}
            ListEmptyComponent={renderEmptyComponent}
            ListFooterComponent={loadingMore ? <LoadingFooter colors={colors} /> : null}
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
            onCausePress={(cause) => {
              // Validate slug exists and is not empty
              if (!cause.slug || cause.slug.trim() === '') {
                console.error('Cause slug is missing or empty:', cause);
                // Fallback to using ID if slug is missing
                if (cause.id) {
                  router.push(`/causes/${cause.id}`);
                } else {
                  console.error('Cause ID is also missing, cannot navigate');
                }
                return;
              }
              router.push(`/causes/${cause.slug}`);
            }} 
          />
        </View>

        <View style={[styles.tabContent, activeTab !== 'events' && styles.tabContentHidden]}>
          <EventsList showSearch={false} showFilters={true} />
        </View>
      </Pressable>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontWeight: '700', letterSpacing: -0.5 },
  searchIconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  closeSearchButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  searchWrapper: { position: 'relative', zIndex: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12 },
  clearButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  suggestionsDropdownWrapper: { position: 'absolute', left: 16, right: 16, zIndex: 9999, elevation: 10, borderRadius: 16, borderWidth: 1, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 }, android: { elevation: 8 } }) },
  suggestionsContainer: { maxHeight: 300 },
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8, borderBottomWidth: 1 },
  suggestionsHeaderText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 12 },
  suggestionIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  suggestionText: { fontSize: 15, flex: 1 },
  searchInfoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12, borderRadius: 12, borderWidth: 1 },
  searchInfoText: { fontSize: 13, fontWeight: '500' },
  filterToggleButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 6 },
  filterToggleText: { fontSize: 13, fontWeight: '600' },
  headerContainer: { paddingBottom: 8 },
  searchHeaderContainer: { backgroundColor: 'transparent', zIndex: 1, paddingHorizontal: 16, paddingTop: 12 },
  filtersScrollContent: { paddingVertical: 8, gap: 8 },
  filterDivider: { width: 1, height: 24, marginHorizontal: 8, alignSelf: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, position: 'relative' },
  chipCheckmark: { marginRight: 6 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  filterChipTextSelected: { fontWeight: '600' },
  filterChipBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 6, paddingHorizontal: 6 },
  filterChipBadgeText: { fontSize: 11, fontWeight: '700' },
  filterPanel: { marginBottom: 16, padding: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 4 } }) },
  filterPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filterPanelTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterPanelTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  filterCloseButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  filterSection: { marginBottom: 20 },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10, letterSpacing: -0.2 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabBar: { borderBottomWidth: 1, paddingVertical: 8, position: 'relative' },
  tabBarContent: { paddingHorizontal: 16, gap: 4, position: 'relative' },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, borderRadius: 20, zIndex: 0 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 1 },
  tabText: { fontWeight: '500' },
  tabTextActive: { fontWeight: '600' },
  tabContent: { flex: 1 },
  tabContentHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 },
  locationBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 14, borderWidth: 1, gap: 12 },
  locationBannerText: { fontSize: 14, flex: 1, fontWeight: '500' },
  enableLocationButton: { borderRadius: 10, overflow: 'hidden' },
  enableLocationGradient: { paddingHorizontal: 16, paddingVertical: 8 },
  enableLocationButtonText: { fontSize: 14, fontWeight: '600' },
  swipeActionsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 16, gap: 8 },
  swipeAction: { borderRadius: 14, overflow: 'hidden' },
  swipeActionGradient: { width: 72, height: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  swipeActionText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  listContent: { padding: 8, flexGrow: 1 },
  listContentGrid: { padding: 8 },
  columnWrapper: { gap: 0 },
  loadingMoreContainer: { paddingVertical: 20, alignItems: 'center' },
  loadingMoreContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 10 },
  loadingMoreText: { fontSize: 13, fontWeight: '500' },
});
