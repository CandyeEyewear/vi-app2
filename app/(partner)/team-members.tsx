/**
 * Partner Team Members Screen
 * Lists all team members belonging to the partner organization
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/colors';
import { ChevronLeft, Users, Clock, Award } from 'lucide-react-native';
import { supabase } from '../../services/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { UserAvatar } from '../../components/index';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  total_hours: number;
  activities_completed: number;
  created_at: string;
}

export default function TeamMembersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const surfaceShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
    web: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    default: {},
  });

  useEffect(() => {
    if (user?.id) loadMembers();
  }, [user?.id]);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, total_hours, activities_completed, created_at')
        .eq('partner_org_id', user!.id)
        .order('full_name');

      if (error) {
        console.error('[TEAM MEMBERS] Error loading:', error);
        return;
      }

      setMembers(data || []);
    } catch (error) {
      console.error('[TEAM MEMBERS] Exception:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMembers();
  }, [user?.id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderMember = ({ item }: { item: TeamMember }) => (
    <AnimatedPressable
      style={[styles.memberCard, surfaceShadow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/user/${item.id}`)}
    >
      <UserAvatar
        avatarUrl={item.avatar_url}
        fullName={item.full_name}
        size={48}
      />
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
          {item.full_name}
        </Text>
        <Text style={[styles.memberEmail, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.email}
        </Text>
        <Text style={[styles.memberJoined, { color: colors.textSecondary }]}>
          Joined {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.memberStats}>
        <View style={styles.statRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={[styles.statText, { color: colors.text }]}>
            {item.total_hours || 0}h
          </Text>
        </View>
        <View style={styles.statRow}>
          <Award size={14} color={colors.textSecondary} />
          <Text style={[styles.statText, { color: colors.text }]}>
            {item.activities_completed || 0}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Users size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Team Members Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Invite people to join your organization
      </Text>
      <AnimatedPressable
        style={[styles.inviteButton, { backgroundColor: '#F59E0B' }]}
        onPress={() => router.push('/(partner)/invite-members')}
      >
        <Text style={styles.inviteButtonText}>Invite Members</Text>
      </AnimatedPressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerContent}>
          <Users size={24} color="#F59E0B" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Team Members
          </Text>
          {!loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{members.length}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            members.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  countBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  memberCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    gap: 14,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 13,
    marginBottom: 2,
  },
  memberJoined: {
    fontSize: 12,
  },
  memberStats: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  inviteButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
