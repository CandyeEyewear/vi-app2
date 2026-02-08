/**
 * Search Screen
 * Find volunteers with server-side debounced search.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search as SearchIcon, UserPlus } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SearchUser {
  id: string;
  full_name: string;
  location: string | null;
  avatar_url: string | null;
}

const SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 250;

const escapeLike = (value: string) => value.replace(/[%_]/g, '\\$&');

export default function SearchScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<SearchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const requestIdRef = useRef(0);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/messages');
  };

  useEffect(() => {
    if (!user?.id) {
      setSearchResults([]);
      setPendingRequests([]);
      setLoadingUsers(false);
      setLoadingRequests(false);
      return;
    }

    const timeout = setTimeout(() => {
      loadUsers(user.id, searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [user?.id, searchQuery]);

  useEffect(() => {
    if (!user?.id) return;
    loadPendingRequests(user.id);
  }, [user?.id]);

  const loadUsers = async (currentUserId: string, rawQuery: string) => {
    const requestId = ++requestIdRef.current;
    setLoadingUsers(true);

    try {
      const query = rawQuery.trim();
      let dbQuery = supabase
        .from('users')
        .select('id, full_name, location, avatar_url')
        .neq('id', currentUserId)
        .order('full_name', { ascending: true })
        .limit(SEARCH_LIMIT);

      if (query.length > 0) {
        dbQuery = dbQuery.ilike('full_name', `%${escapeLike(query)}%`);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;

      // Ignore stale responses from older requests.
      if (requestId !== requestIdRef.current) return;
      setSearchResults((data || []) as SearchUser[]);
    } catch (error) {
      console.error('Error loading users:', error);
      if (requestId === requestIdRef.current) {
        setSearchResults([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingUsers(false);
      }
    }
  };

  const loadPendingRequests = async (currentUserId: string) => {
    setLoadingRequests(true);
    try {
      const { data: circleData, error: circleError } = await supabase
        .from('user_circles')
        .select('user_id')
        .eq('circle_user_id', currentUserId)
        .eq('status', 'pending');
      if (circleError) throw circleError;

      if (!circleData || circleData.length === 0) {
        setPendingRequests([]);
        return;
      }

      const userIds = circleData.map((item) => item.user_id);

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, location, avatar_url')
        .in('id', userIds);
      if (usersError) throw usersError;

      setPendingRequests((usersData || []) as SearchUser[]);
    } catch (error) {
      console.error('Error loading pending requests:', error);
      setPendingRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAcceptRequest = async (requestUserId: string) => {
    if (!user?.id) return;

    try {
      const { error: acceptError } = await supabase
        .from('user_circles')
        .update({ status: 'accepted' })
        .eq('user_id', requestUserId)
        .eq('circle_user_id', user.id)
        .eq('status', 'pending');
      if (acceptError) throw acceptError;

      const { error: reverseError } = await supabase
        .from('user_circles')
        .insert({
          user_id: user.id,
          circle_user_id: requestUserId,
          status: 'accepted',
        });
      if (reverseError) throw reverseError;

      await loadPendingRequests(user.id);
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = async (requestUserId: string) => {
    if (!user?.id) return;

    try {
      const { error: deleteError } = await supabase
        .from('user_circles')
        .delete()
        .eq('user_id', requestUserId)
        .eq('circle_user_id', user.id);
      if (deleteError) throw deleteError;

      await supabase
        .from('user_circles')
        .delete()
        .eq('user_id', user.id)
        .eq('circle_user_id', requestUserId);

      await loadPendingRequests(user.id);
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const renderPendingRequest = (item: SearchUser) => (
    <View style={[styles.requestCard, { backgroundColor: colors.background, borderColor: colors.primary }]}>
      <View style={styles.requestInfo}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.full_name}</Text>
          {item.location ? (
            <Text style={[styles.userLocation, { color: colors.textSecondary }]}>{item.location}</Text>
          ) : null}
          <Text style={[styles.requestLabel, { color: colors.primary }]}>wants to add you to their circle</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.primary }]}
          onPress={() => handleAcceptRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: colors.border }]}
          onPress={() => handleRejectRequest(item.id)}
        >
          <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUser = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
      onPress={() => router.push(`/profile/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.userInfo}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.full_name}</Text>
          {item.location ? (
            <Text style={[styles.userLocation, { color: colors.textSecondary }]}>{item.location}</Text>
          ) : null}
        </View>
      </View>
      <UserPlus size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  const pendingHeader = useMemo(() => {
    if (pendingRequests.length === 0 || searchQuery.trim().length > 0) return null;
    return (
      <View>
        <Text style={[styles.sectionHeader, { color: colors.text }]}>
          Circle Requests ({pendingRequests.length})
        </Text>
        {pendingRequests.map((request) => (
          <View key={request.id}>
            {renderPendingRequest(request)}
          </View>
        ))}
        <Text style={[styles.sectionHeader, { color: colors.text, marginTop: 16 }]}>All Volunteers</Text>
      </View>
    );
  }, [pendingRequests, searchQuery, colors.text, colors.textSecondary, colors.primary, colors.border, colors.background]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Find Volunteers</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SearchIcon size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
        </View>
      </View>

      {loadingUsers || loadingRequests ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={pendingHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No volunteers found' : 'No volunteers available'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userLocation: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  requestCard: {
    backgroundColor: Colors.light.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderWidth: 1,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
