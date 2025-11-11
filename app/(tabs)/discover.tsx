/**
 * Discover Tab Screen
 * Browse and search volunteer opportunities
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { Opportunity, OpportunityCategory } from '../../types';
import { Colors } from '../../constants/colors';
import { OpportunityCard } from '../../components/cards/OpportunityCard';
import { supabase } from '../../services/supabase';

const CATEGORIES: { value: OpportunityCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'poorRelief', label: 'Poor Relief' },
  { value: 'community', label: 'Community' },
];

export default function DiscoverScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const categoryScrollRef = useRef<FlatList>(null);
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<OpportunityCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOpportunities();
  }, []);

  // Reload when screen comes into focus (e.g., after deleting an opportunity)
  useFocusEffect(
    React.useCallback(() => {
      loadOpportunities();
    }, [])
  );

  useEffect(() => {
    filterOpportunities();
  }, [opportunities, selectedCategory, searchQuery]);

  const loadOpportunities = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('status', 'active')
        .order('date', { ascending: true });

      if (error) throw error;

      const opportunitiesData: Opportunity[] = data.map((opp) => ({
        id: opp.id,
        title: opp.title,
        description: opp.description,
        organizationName: opp.organization_name,
        organizationVerified: opp.organization_verified,
        category: opp.category,
        location: opp.location,
        latitude: opp.latitude,
        longitude: opp.longitude,
        date: opp.date,
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
      }));

      setOpportunities(opportunitiesData);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOpportunities = () => {
    let filtered = [...opportunities];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((opp) => opp.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (opp) =>
          opp.title.toLowerCase().includes(query) ||
          opp.description.toLowerCase().includes(query) ||
          opp.organizationName.toLowerCase().includes(query) ||
          opp.location.toLowerCase().includes(query)
      );
    }

    setFilteredOpportunities(filtered);
  };

  const handleOpportunityPress = (opportunity: Opportunity) => {
    router.push(`/opportunity/${opportunity.id}`);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search opportunities..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

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
            onPress={() => setSelectedCategory(item.value)}
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
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        {/* Header with SafeAreaInsets */}
        <View style={[
          styles.header,
          { paddingTop: insets.top + 16, backgroundColor: colors.background, borderBottomColor: colors.border }
        ]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Find volunteer opportunities
          </Text>
        </View>

        {/* Opportunities List */}
        <FlatList
          data={filteredOpportunities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OpportunityCard opportunity={item} onPress={handleOpportunityPress} />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadOpportunities}
              tintColor={colors.tint}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.text }]}>No opportunities found</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Try adjusting your filters or search terms
                </Text>
              </View>
            )
          }
        />
      </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  headerContainer: {
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  categoriesContainer: {
    paddingRight: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
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
  },
});