/**
 * Notifications Screen
 * Shows all user notifications grouped by type
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Bell, MessageCircle, Calendar, UserPlus, Megaphone, Trash2, Check, X, User, Heart, Ticket, Sparkles } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import CustomAlert from '../components/CustomAlert';
import { NotificationsSkeleton } from '../components/SkeletonLayouts';
import { cache, CacheKeys } from '../services/cache';
import { UserAvatar } from '../components/index';
import { goBack } from '../utils/navigation';

interface Notification {
  id: string;
  type: 'circle_request' | 'announcement' | 'opportunity' | 'message' | 'opportunity_submitted' | 'opportunity_approved' | 'opportunity_rejected' | 'cause' | 'event' | 'shoutout_received';
  title: string;
  message: string;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
  sender_id?: string | null;
}

interface SenderInfo {
  id: string;
  avatarUrl: string | null;
  fullName: string;
  role?: string;
  membershipTier?: string;
  membershipStatus?: string;
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
  const [senderAvatars, setSenderAvatars] = useState<Map<string, SenderInfo>>(new Map());
  const [notificationSenderMap, setNotificationSenderMap] = useState<Map<string, string>>(new Map()); // notificationId -> senderId

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  // Refresh notifications when screen comes into focus (especially important for mobile web)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadNotifications();
      }
    }, [user])
  );

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

      // Load sender avatars for message and circle_request notifications
      await loadSenderAvatars(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSenderAvatars = async (notifications: Notification[]) => {
    const avatarMap = new Map<string, SenderInfo>();
    const senderIds = new Set<string>();
    const notificationToSenderMap = new Map<string, string>(); // notificationId -> senderId

    // Process circle_request notifications - related_id is the sender's user_id
    notifications.forEach((notification) => {
      if (notification.type === 'circle_request' && notification.related_id) {
        const senderId = notification.related_id;
        senderIds.add(senderId);
        notificationToSenderMap.set(notification.id, senderId);
      }
      // Process shoutout_received notifications - sender_id is the person who gave the shoutout
      if (notification.type === 'shoutout_received' && notification.sender_id) {
        senderIds.add(notification.sender_id);
        notificationToSenderMap.set(notification.id, notification.sender_id);
      }
    });

    // Process message notifications - prioritize sender_id if available, otherwise lookup conversation
    const messageNotifications = notifications.filter(n => n.type === 'message' && !notificationToSenderMap.has(n.id));
    for (const notification of messageNotifications) {
      // First check if sender_id is directly set (newer notifications)
      if (notification.sender_id) {
        senderIds.add(notification.sender_id);
        notificationToSenderMap.set(notification.id, notification.sender_id);
      } else if (notification.related_id) {
        // Fallback: Get sender from conversation (for older notifications without sender_id)
        try {
          const { data: convData } = await supabase
            .from('conversations')
            .select('participants')
            .eq('id', notification.related_id)
            .single();

          if (convData && convData.participants) {
            const otherUserId = convData.participants.find((id: string) => id !== user?.id);
            if (otherUserId) {
              senderIds.add(otherUserId);
              notificationToSenderMap.set(notification.id, otherUserId);
            }
          }
        } catch (e) {
          console.error('Error loading conversation for notification:', e);
        }
      }
    }

    // Also check if sender_id is directly set for any other notification types
    notifications.forEach((notification) => {
      if (notification.sender_id && !notificationToSenderMap.has(notification.id)) {
        senderIds.add(notification.sender_id);
        notificationToSenderMap.set(notification.id, notification.sender_id);
      }
    });

    // Fetch all sender user data
    if (senderIds.size > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, role, membership_tier, membership_status')
          .in('id', Array.from(senderIds));

        if (usersData) {
          usersData.forEach((userData) => {
            avatarMap.set(userData.id, {
              id: userData.id,
              avatarUrl: userData.avatar_url,
              fullName: userData.full_name,
              role: userData.role || 'volunteer',
              membershipTier: userData.membership_tier || 'free',
              membershipStatus: userData.membership_status || 'inactive',
            });
          });
        }
      } catch (e) {
        console.error('Error loading sender avatars:', e);
      }
    }

    setSenderAvatars(avatarMap);
    setNotificationSenderMap(notificationToSenderMap);
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

  const getSenderId = (notification: Notification): string | null => {
    if (notification.type === 'circle_request' && notification.related_id) {
      // For circle requests, related_id is typically the sender's user_id
      return notification.related_id;
    }
    if (notification.type === 'message' && notification.related_id) {
      // For messages, we need to find the sender from the conversation
      // This will be handled in loadSenderAvatars, but we can also check here
      // We'll use a helper to get it from the conversation
      return null; // Will be resolved via conversation lookup
    }
    return notification.sender_id || null;
  };

  const getNotificationStyle = (type: string) => {
    const styles = {
      announcement: {
        icon: Megaphone,
        gradient: [Colors.gradients.accent[0], Colors.gradients.accent[1]],
        iconBg: colors.accentSoft,
        iconColor: colors.accent,
        borderColor: colors.accent,
      },
      opportunity: {
        icon: Calendar,
        gradient: [Colors.gradients.primary[0], Colors.gradients.primary[1]],
        iconBg: colors.primarySoft,
        iconColor: colors.primary,
        borderColor: colors.primary,
      },
      cause: {
        icon: Heart,
        gradient: ['#EC4899', '#F472B6'],
        iconBg: 'rgba(236, 72, 153, 0.15)',
        iconColor: '#EC4899',
        borderColor: '#EC4899',
      },
      event: {
        icon: Ticket,
        gradient: ['#8B5CF6', '#A78BFA'],
        iconBg: 'rgba(139, 92, 246, 0.15)',
        iconColor: '#8B5CF6',
        borderColor: '#8B5CF6',
      },
      message: {
        icon: MessageCircle,
        gradient: Colors.gradients.ocean,
        iconBg: colors.infoSoft,
        iconColor: colors.info,
        borderColor: colors.info,
      },
      circle_request: {
        icon: UserPlus,
        gradient: Colors.gradients.purple,
        iconBg: colors.communitySoft,
        iconColor: colors.community,
        borderColor: colors.community,
      },
      shoutout_received: {
        icon: Sparkles,
        gradient: ['#F59E0B', '#FBBF24'],
        iconBg: 'rgba(245, 158, 11, 0.15)',
        iconColor: '#F59E0B',
        borderColor: '#F59E0B',
      },
      default: {
        icon: Bell,
        gradient: [colors.primary, colors.primaryDark],
        iconBg: colors.primarySoft,
        iconColor: colors.primary,
        borderColor: colors.primary,
      },
    };
    return styles[type as keyof typeof styles] || styles.default;
  };

  const getNotificationAvatar = (notification: Notification): SenderInfo | null => {
    if (notification.type !== 'message' && notification.type !== 'circle_request' && notification.type !== 'shoutout_received') {
      return null;
    }

    // Get sender ID from the mapping
    const senderId = notificationSenderMap.get(notification.id);
    if (!senderId) {
      return null;
    }

    return senderAvatars.get(senderId) || null;
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
    const notifStyle = getNotificationStyle(item.type);
    const Icon = notifStyle.icon;
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.notificationCard,
          { 
            backgroundColor: item.is_read ? colors.card : colors.surfaceElevated,
            borderColor: colors.border,
          },
          isSelected && { 
            backgroundColor: notifStyle.iconBg,
            borderColor: notifStyle.borderColor,
            borderWidth: 2,
          },
          pressed && { transform: [{ scale: 0.98 }] }
        ]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => handleNotificationLongPress(item.id)}
        delayLongPress={500}
      >
        {/* Gradient accent bar on left */}
        <LinearGradient
          colors={notifStyle.gradient}
          style={styles.accentBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {isSelected && (
          <View style={[styles.selectionIndicator, { backgroundColor: notifStyle.iconColor }]}>
            <Check size={16} color={colors.textOnPrimary} strokeWidth={3} />
          </View>
        )}

        {/* Show avatar for message, circle_request, and shoutout_received, enhanced icon for others */}
        {(item.type === 'message' || item.type === 'circle_request' || item.type === 'shoutout_received') ? (
          (() => {
            const senderInfo = getNotificationAvatar(item);
            return (
              <View style={styles.avatarContainer}>
                <UserAvatar
                  avatarUrl={senderInfo?.avatarUrl || null}
                  fullName={senderInfo?.fullName || 'User'}
                  size="md"
                  role={senderInfo?.role || 'volunteer'}
                  membershipTier={senderInfo?.membershipTier || 'free'}
                  membershipStatus={senderInfo?.membershipStatus || 'inactive'}
                />
              </View>
            );
          })()
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: notifStyle.iconBg }]}>
            <Icon size={22} color={notifStyle.iconColor} strokeWidth={2} />
          </View>
        )}

        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && !isSelected && (
              <View style={styles.newBadge}>
                <Sparkles size={10} color={colors.textOnPrimary} fill={colors.textOnPrimary} />
                <Text style={[styles.newBadgeText, { color: colors.textOnPrimary }]}>NEW</Text>
              </View>
            )}
          </View>
          <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
      </Pressable>
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
        <Pressable 
          onPress={() => {
            if (selectedNotifications.length > 0) {
              clearSelection();
            } else {
              goBack('/(tabs)/feed');
            }
          }} 
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surfaceElevated },
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
          ]}
        >
          {selectedNotifications.length > 0 ? (
            <X size={24} color={colors.text} />
          ) : (
            <ChevronLeft size={24} color={colors.text} />
          )}
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {selectedNotifications.length > 0 
            ? `${selectedNotifications.length} selected` 
            : 'Notifications'}
        </Text>
        {selectedNotifications.length > 0 ? (
          <Pressable 
            onPress={handleDeleteSelected} 
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: colors.errorSoft },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
            ]}
          >
            <Trash2 size={20} color={colors.error} />
          </Pressable>
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
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.primarySoft }]}>
                <Bell size={48} color={colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                All caught up! 🎉
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                You'll see updates here when you receive new notifications
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
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    maxWidth: 700,
    width: '100%' as any,
    alignSelf: 'center' as any,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    paddingLeft: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.2,
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});