/**
 * Notifications Screen
 * Shows all user notifications grouped by type
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, MessageCircle, Calendar, UserPlus, Megaphone, Trash2, Check, X } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import CustomAlert from '../components/CustomAlert';
import { NotificationsSkeleton } from '../components/SkeletonLayouts';

interface Notification {
  id: string;
  type: 'circle_request' | 'announcement' | 'opportunity' | 'message' | 'opportunity_submitted' | 'opportunity_approved' | 'opportunity_rejected';
  title: string;
  message: string;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // If we're in selection mode, toggle selection instead
    if (selectedNotifications.length > 0) {
      toggleNotificationSelection(notification.id);
      return;
    }

    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to linked screen
    if (notification.link) {
      router.push(notification.link as any);
    }
  };

  const handleNotificationLongPress = (notificationId: string) => {
    toggleNotificationSelection(notificationId);
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev => {
      if (prev.includes(notificationId)) {
        return prev.filter(id => id !== notificationId);
      } else {
        return [...prev, notificationId];
      }
    });
  };

  const clearSelection = () => {
    setSelectedNotifications([]);
  };

  const handleDeleteSelected = () => {
    if (selectedNotifications.length === 0) return;
    setShowDeleteAlert(true);
  };

  const deleteSelectedNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', selectedNotifications);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => !selectedNotifications.includes(n.id)));
      setSelectedNotifications([]);
      setShowDeleteAlert(false);
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'circle_request':
        return <UserPlus size={20} color={colors.primary} />;
      case 'announcement':
        return <Megaphone size={20} color={colors.primary} />;
      case 'opportunity':
        return <Calendar size={20} color={colors.primary} />;
      case 'message':
        return <MessageCircle size={20} color={colors.primary} />;
      default:
        return <Bell size={20} color={colors.primary} />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isSelected = selectedNotifications.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          { backgroundColor: item.is_read ? colors.card : colors.background },
          { borderLeftColor: colors.primary },
          isSelected && { backgroundColor: colors.primary + '20' },
        ]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => handleNotificationLongPress(item.id)}
        activeOpacity={0.7}
        delayLongPress={500}
      >
        {isSelected && (
          <View style={[styles.selectionIndicator, { backgroundColor: colors.primary }]}>
            <Check size={16} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.iconContainer}>{getIcon(item.type)}</View>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
        {!item.is_read && !isSelected && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => {
          if (selectedNotifications.length > 0) {
            clearSelection();
          } else {
            router.back();
          }
        }} style={styles.backButton}>
          {selectedNotifications.length > 0 ? (
            <X size={28} color={colors.primary} />
          ) : (
            <ChevronLeft size={28} color={colors.primary} />
          )}
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {selectedNotifications.length > 0 
            ? `${selectedNotifications.length} selected` 
            : 'Notifications'}
        </Text>
        {selectedNotifications.length > 0 ? (
          <TouchableOpacity onPress={handleDeleteSelected} style={styles.deleteButton}>
            <Trash2 size={24} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.listContent}>
          <NotificationsSkeleton count={5} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Bell size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No notifications yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                You'll see updates here when you receive notifications
              </Text>
            </View>
          }
        />
      )}

      {/* Delete Confirmation Alert */}
      <CustomAlert
        visible={showDeleteAlert}
        type="warning"
        title="Delete Notifications"
        message={`Are you sure you want to delete ${selectedNotifications.length} notification${selectedNotifications.length > 1 ? 's' : ''}? This action cannot be undone.`}
        showCancel={true}
        onClose={() => setShowDeleteAlert(false)}
        onConfirm={deleteSelectedNotifications}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});