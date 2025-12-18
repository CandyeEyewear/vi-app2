/**
 * Supervisor Manage Announcements Screen
 * View and edit announcements - No delete access
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/colors';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  ArrowLeft,
  Plus,
  Megaphone,
  Edit3,
  Eye,
  MoreVertical,
  Calendar,
} from 'lucide-react-native';
import { AnimatedPressable } from '../../../components/AnimatedPressable';

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
};

interface AnnouncementItemProps {
  announcement: Announcement;
  colors: any;
  onView: () => void;
  onEdit: () => void;
}

function AnnouncementItem({ announcement, colors, onView, onEdit }: AnnouncementItemProps) {
  const [showActions, setShowActions] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.announcementItem, 
        { 
          backgroundColor: pressed ? colors.surfacePressed : colors.card, 
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        }
      ]}
      onPress={onView}
    >
      <View style={styles.announcementHeader}>
        <View style={styles.announcementTitleRow}>
          <Text style={[styles.announcementTitle, { color: colors.text }]} numberOfLines={2}>
            {announcement.title}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.moreButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
          onPress={() => setShowActions(!showActions)}
        >
          <MoreVertical size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Text style={[styles.announcementContent, { color: colors.textSecondary }]} numberOfLines={3}>
        {announcement.content}
      </Text>

      <View style={styles.announcementFooter}>
        <View style={styles.dateRow}>
          <Calendar size={12} color={colors.textSecondary} />
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDate(announcement.created_at)}
          </Text>
        </View>
      </View>

      {/* Actions Dropdown */}
      {showActions && (
        <View style={[styles.actionsDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onView}
          >
            <Eye size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>View</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.actionItem,
              { backgroundColor: pressed ? colors.surfacePressed : 'transparent' }
            ]}
            onPress={onEdit}
          >
            <Edit3 size={18} color="#9C27B0" />
            <Text style={[styles.actionText, { color: '#9C27B0' }]}>Edit</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function SupervisorAnnouncementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { user, isSup } = useAuth();

  // State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Check supervisor access
  useEffect(() => {
    if (user && !isSup) {
      router.back();
    }
  }, [user, isSup, router]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        return;
      }

      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Handle view
  const handleView = useCallback((announcement: Announcement) => {
    // Navigate to announcement detail or show in modal
    // For now, just show alert
    router.push(`/create-announcement?id=${announcement.id}`);
  }, [router]);

  // Handle edit
  const handleEdit = useCallback((announcement: Announcement) => {
    router.push(`/create-announcement?id=${announcement.id}`);
  }, [router]);

  // Render announcement item
  const renderAnnouncementItem = useCallback(({ item }: { item: Announcement }) => (
    <AnnouncementItem
      announcement={item}
      colors={colors}
      onView={() => handleView(item)}
      onEdit={() => handleEdit(item)}
    />
  ), [colors, handleView, handleEdit]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Megaphone size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No announcements found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Create your first announcement to get started
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.createButtonEmpty, 
            { 
              backgroundColor: '#9C27B0',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            }
          ]}
          onPress={() => router.push('/create-announcement')}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={[styles.createButtonEmptyText, { color: '#FFFFFF' }]}>Create Announcement</Text>
        </Pressable>
      </View>
    );
  }, [loading, colors, router]);

  if (!isSup) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.error }]}>Access Denied</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <Pressable 
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Announcements</Text>
        <Pressable
          style={({ pressed }) => [
            styles.addButton, 
            { 
              backgroundColor: '#9C27B0',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            }
          ]}
          onPress={() => router.push('/create-announcement')}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Announcements Count */}
      {!loading && announcements.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {announcements.length} {announcements.length === 1 ? 'announcement' : 'announcements'}
          </Text>
        </View>
      )}

      {/* Announcements List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading announcements...</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          renderItem={renderAnnouncementItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#9C27B0"
              colors={['#9C27B0']}
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  announcementItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  announcementTitleRow: {
    flex: 1,
    marginRight: 8,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  moreButton: {
    padding: 4,
    marginRight: -4,
  },
  announcementContent: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
  },
  actionsDropdown: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

