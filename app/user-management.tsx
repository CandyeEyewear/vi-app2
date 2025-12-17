/**
 * User Management Screen
 * View all users, assign admin roles, view user stats
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { 
  ChevronLeft,
  Users,
  Search,
  Shield,
  ShieldCheck,
  Clock,
  Award,
  MapPin,
  Mail,
  Ban,
  Crown,
} from 'lucide-react-native';
import { supabase } from '../services/supabase';
import CustomAlert from '../components/CustomAlert';
import { User } from '../types';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '../components/AnimatedPressable';

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  admins: number;
  bannedUsers: number;
}

export default function UserManagementScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser, refreshSession } = useAuth();

  const surfaceShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    web: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    default: {},
  });

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    admins: 0,
    bannedUsers: 0,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
    onConfirm: undefined as (() => void) | undefined,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const showAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'warning' = 'success',
    onConfirm?: () => void
  ) => {
    setAlertConfig({ title, message, type, onConfirm });
    setAlertVisible(true);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUsers = data.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone || '',
        location: u.location || '',
        bio: u.bio,
        avatarUrl: u.avatar_url,
        role: u.role,
        isBanned: u.is_banned,
        bannedUntil: u.banned_until,
        banReason: u.ban_reason,
        isPrivate: u.is_private,
        totalHours: u.total_hours || 0,
        activitiesCompleted: u.activities_completed || 0,
        organizationsHelped: u.organizations_helped || 0,
        achievements: [],
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      setUsers(formattedUsers);
      calculateStats(formattedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      showAlert('Error', 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (userList: User[]) => {
    const totalUsers = userList.length;
    const activeUsers = userList.filter(u => u.totalHours > 0).length;
    const admins = userList.filter(u => u.role === 'admin').length;
    const bannedUsers = userList.filter(u => u.isBanned).length;

    setStats({ totalUsers, activeUsers, admins, bannedUsers });
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(u => 
      u.fullName.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.location?.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  const assignAdminRole = async (userId: string, userName: string) => {
    showAlert(
      'Assign Admin Role',
      `Make ${userName} an admin? They will have full access to moderation and admin features.`,
      'warning',
      async () => {
        try {
          const { data: result, error } = await supabase.functions.invoke('admin-set-user-role', {
            body: { userId, role: 'admin' },
          });
          if (error) {
            const details = (error as any)?.context?.body ? `\n\n${(error as any).context.body}` : '';
            throw new Error(`${error.message || 'Role update failed'}${details}`);
          }
          if (result?.success === false) throw new Error(result?.error || 'Failed to assign admin role');

          // Log moderation action
          await supabase.from('moderation_actions').insert({
            admin_id: currentUser?.id,
            action_type: 'assign_admin',
            target_type: 'user',
            target_id: userId,
          });

          if (userId === currentUser?.id) {
            const ok = await refreshSession();
            showAlert(
              'Success',
              ok
                ? `You're now an admin. Your session was refreshed.`
                : `You're now an admin. Please sign out/in to refresh permissions.`,
              'success'
            );
          } else {
            showAlert(
              'Success',
              `${userName} is now an admin. They may need to sign out/in to refresh permissions.`,
              'success'
            );
          }
          loadUsers();
        } catch (error: any) {
          console.error('Error assigning admin role:', error);
          showAlert('Error', error?.message || 'Failed to assign admin role', 'error');
        }
      }
    );
  };

  const assignSupRole = async (userId: string, userName: string) => {
    showAlert(
      'Assign Sup Role',
      `Make ${userName} a Sup? They can view participants and approve check-ins for opportunities.`,
      'warning',
      async () => {
        try {
          const { data: result, error } = await supabase.functions.invoke('admin-set-user-role', {
            body: { userId, role: 'sup' },
          });
          if (error) {
            const details = (error as any)?.context?.body ? `\n\n${(error as any).context.body}` : '';
            throw new Error(`${error.message || 'Role update failed'}${details}`);
          }
          if (result?.success === false) throw new Error(result?.error || 'Failed to assign Sup role');

          await supabase.from('moderation_actions').insert({
            admin_id: currentUser?.id,
            action_type: 'assign_sup',
            target_type: 'user',
            target_id: userId,
          });

          if (userId === currentUser?.id) {
            const ok = await refreshSession();
            showAlert(
              'Success',
              ok
                ? `You're now a Sup. Your session was refreshed.`
                : `You're now a Sup. Please sign out/in to refresh permissions.`,
              'success'
            );
          } else {
            showAlert(
              'Success',
              `${userName} is now a Sup. They may need to sign out/in to refresh permissions.`,
              'success'
            );
          }
          loadUsers();
        } catch (error: any) {
          console.error('Error assigning Sup role:', error);
          showAlert('Error', error?.message || 'Failed to assign Sup role', 'error');
        }
      }
    );
  };

  const removeAdminRole = async (userId: string, userName: string) => {
    // Prevent removing your own admin role
    if (userId === currentUser?.id) {
      showAlert('Error', 'You cannot remove your own admin role', 'error');
      return;
    }

    showAlert(
      'Remove Admin Role',
      `Remove admin access from ${userName}? They will become a regular volunteer.`,
      'warning',
      async () => {
        try {
          const { data: result, error } = await supabase.functions.invoke('admin-set-user-role', {
            body: { userId, role: 'volunteer' },
          });
          if (error) {
            const details = (error as any)?.context?.body ? `\n\n${(error as any).context.body}` : '';
            throw new Error(`${error.message || 'Role update failed'}${details}`);
          }
          if (result?.success === false) throw new Error(result?.error || 'Failed to remove admin role');

          // Log moderation action
          await supabase.from('moderation_actions').insert({
            admin_id: currentUser?.id,
            action_type: 'remove_admin',
            target_type: 'user',
            target_id: userId,
          });

          showAlert('Success', `${userName} is now a volunteer`, 'success');
          loadUsers();
        } catch (error: any) {
          console.error('Error removing admin role:', error);
          showAlert('Error', error?.message || 'Failed to remove admin role', 'error');
        }
      }
    );
  };

  const removeSupRole = async (userId: string, userName: string) => {
    showAlert(
      'Remove Sup Role',
      `Remove Sup access from ${userName}? They will become a regular volunteer.`,
      'warning',
      async () => {
        try {
          const { data: result, error } = await supabase.functions.invoke('admin-set-user-role', {
            body: { userId, role: 'volunteer' },
          });
          if (error) {
            const details = (error as any)?.context?.body ? `\n\n${(error as any).context.body}` : '';
            throw new Error(`${error.message || 'Role update failed'}${details}`);
          }
          if (result?.success === false) throw new Error(result?.error || 'Failed to remove Sup role');

          await supabase.from('moderation_actions').insert({
            admin_id: currentUser?.id,
            action_type: 'remove_sup',
            target_type: 'user',
            target_id: userId,
          });

          showAlert('Success', `${userName} is now a volunteer`, 'success');
          loadUsers();
        } catch (error: any) {
          console.error('Error removing Sup role:', error);
          showAlert('Error', error?.message || 'Failed to remove Sup role', 'error');
        }
      }
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const renderUserCard = (user: User) => {
    const isAdmin = user.role === 'admin';
    const isSup = user.role === 'sup';
    const isCurrentUser = user.id === currentUser?.id;

    return (
      <LinearGradient
        key={user.id}
        colors={[colors.card, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, surfaceShadow, { borderColor: colors.border }]}
      >
        {/* User Header */}
        <View style={styles.userHeader}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {user.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          <View style={styles.userInfo}>
  <View style={styles.nameRow}>
    <AnimatedPressable onPress={() => router.push(`/profile/${user.slug || user.id}`)}>
      <Text style={[styles.userName, { color: colors.text }]}>
        {user.fullName}
      </Text>
    </AnimatedPressable>
              {isCurrentUser && (
                <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.youBadgeText, { color: colors.primary }]}>You</Text>
                </View>
              )}
            </View>
            <View style={styles.infoRow}>
              <Mail size={14} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {user.email}
              </Text>
            </View>
            {user.location && (
              <View style={styles.infoRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {user.location}
                </Text>
              </View>
            )}
          </View>

          {/* Role Badge */}
          {isAdmin ? (
            <View style={[styles.adminBadge, { backgroundColor: colors.primary + '20' }]}>
              <Crown size={14} color={colors.primary} />
              <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Admin</Text>
            </View>
          ) : isSup ? (
            <View style={[styles.adminBadge, { backgroundColor: colors.success + '20' }]}>
              <ShieldCheck size={14} color={colors.success} />
              <Text style={[styles.adminBadgeText, { color: colors.success }]}>Sup</Text>
            </View>
          ) : user.isBanned ? (
            <View style={[styles.bannedBadge, { backgroundColor: colors.error + '20' }]}>
              <Ban size={14} color={colors.error} />
              <Text style={[styles.bannedBadgeText, { color: colors.error }]}>Banned</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Clock size={16} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {user.totalHours}h
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Hours
            </Text>
          </View>
          <View style={styles.stat}>
            <Award size={16} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {user.activitiesCompleted}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Activities
            </Text>
          </View>
          <View style={styles.stat}>
            <Users size={16} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {user.organizationsHelped}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Organizations
            </Text>
          </View>
        </View>

        {/* Member Since */}
        <Text style={[styles.memberSince, { color: colors.textSecondary }]}>
          Member since {formatDate(user.createdAt)}
        </Text>

        {/* Actions */}
        {!isCurrentUser && !user.isBanned && (
          <View style={styles.actions}>
            {isAdmin ? (
              <AnimatedPressable
                style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.textSecondary }]}
                onPress={() => removeAdminRole(user.id, user.fullName)}
              >
                <Shield size={18} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Remove Admin</Text>
              </AnimatedPressable>
            ) : (
              <>
                <AnimatedPressable
                  style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.primary }]}
                  onPress={() => assignAdminRole(user.id, user.fullName)}
                >
                  <ShieldCheck size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Make Admin</Text>
                </AnimatedPressable>

                {!isSup ? (
                  <AnimatedPressable
                    style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.success }]}
                    onPress={() => assignSupRole(user.id, user.fullName)}
                  >
                    <ShieldCheck size={18} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Make Sup</Text>
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable
                    style={[styles.actionButton, surfaceShadow, { backgroundColor: colors.textSecondary }]}
                    onPress={() => removeSupRole(user.id, user.fullName)}
                  >
                    <Shield size={18} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Remove Sup</Text>
                  </AnimatedPressable>
                )}
              </>
            )}
          </View>
        )}
      </LinearGradient>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerTitleContainer}>
          <Users size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            User Management
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Stats Overview */}
      <View style={styles.statsOverview}>
        <LinearGradient
          colors={[colors.card, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
        >
          <Users size={20} color={colors.primary} />
          <Text style={[styles.statCardValue, { color: colors.text }]}>{stats.totalUsers}</Text>
          <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>Total Users</Text>
        </LinearGradient>
        <LinearGradient
          colors={[colors.card, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
        >
          <Award size={20} color={colors.success} />
          <Text style={[styles.statCardValue, { color: colors.text }]}>{stats.activeUsers}</Text>
          <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>Active</Text>
        </LinearGradient>
        <LinearGradient
          colors={[colors.card, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
        >
          <Crown size={20} color={colors.primary} />
          <Text style={[styles.statCardValue, { color: colors.text }]}>{stats.admins}</Text>
          <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>Admins</Text>
        </LinearGradient>
        <LinearGradient
          colors={[colors.card, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.statCard, surfaceShadow, { borderColor: colors.border }]}
        >
          <Ban size={20} color={colors.error} />
          <Text style={[styles.statCardValue, { color: colors.text }]}>{stats.bannedUsers}</Text>
          <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>Banned</Text>
        </LinearGradient>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search users by name, email, or location..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* User List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadUsers}
            tintColor={colors.primary}
          />
        }
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {searchQuery ? 'No users found' : 'No users yet'}
            </Text>
            {searchQuery && (
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Try a different search term
              </Text>
            )}
          </View>
        ) : (
          filteredUsers.map(renderUserCard)
        )}
      </ScrollView>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
        onConfirm={alertConfig.onConfirm}
        showCancel={!!alertConfig.onConfirm}
      />
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsOverview: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 6,
  },
  statCardLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    height: 32,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bannedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    height: 32,
  },
  bannedBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  memberSince: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
});
