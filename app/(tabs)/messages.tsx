/**
 * Messages Tab Screen
 * Lists all conversations
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  useColorScheme,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useMessaging } from '../../contexts/MessagingContext';
import { Colors } from '../../constants/colors';
import { Conversation } from '../../types';
import CustomAlert from '../../components/CustomAlert';
import { useAlert, showErrorAlert } from '../../hooks/useAlert';
import OnlineStatusDot from '../../components/OnlineStatusDot';
import { ConversationsSkeleton } from '../../components/SkeletonLayouts';
import { supabase } from '../../services/supabase';
import { UserAvatar, UserNameWithBadge } from '../../components/index';
import WebContainer from '../../components/WebContainer';
import Head from 'expo-router/head';

export default function MessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 992;
  const { user } = useAuth();
  const { conversations, loading, refreshConversations, deleteConversation } = useMessaging();
  const { alertProps, showAlert } = useAlert();
  
  // Track online status per conversation using presence channels
  const [onlineStatusMap, setOnlineStatusMap] = useState<Record<string, boolean>>({});
  const presenceChannelsRef = useRef<Record<string, any>>({});

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Less than 1 minute
    if (seconds < 60) return 'now';
    
    // Less than 1 hour - show minutes
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    
    // Check if it's today
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }

    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) return 'Yesterday';

    // Within last week - show day name
    if (seconds < 604800) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Older - show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDeleteConversation = (conversationId: string, userName: string) => {
    showAlert({
      type: 'warning',
      title: 'Delete Conversation',
      message: `Are you sure you want to delete your conversation with ${userName}? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await deleteConversation(conversationId);
            if (!response.success) {
              showAlert(showErrorAlert('Error', 'Failed to delete conversation'));
            }
          },
        },
      ],
    });
  };

  // Set up presence channels for all conversations to track online status
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    // Get other user IDs for all conversations
    const conversationChannels = conversations.map((conv) => {
      const otherUser = conv.participantDetails.find((p) => p.id !== user.id);
      return { conversationId: conv.id, otherUserId: otherUser?.id };
    }).filter((item) => item.otherUserId);

    // Subscribe to presence channels for each conversation
    conversationChannels.forEach(({ conversationId, otherUserId }) => {
      // Skip if already subscribed
      if (presenceChannelsRef.current[conversationId]) return;

      const presenceChannel = supabase.channel(`presence:${conversationId}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const presences = Object.values(state).flat() as any[];
          
          // Check if other user is actively online in this conversation (online: true)
          const otherUserPresence = presences.find(
            (p: any) => p.user_id === otherUserId && p.online === true
          );
          
          setOnlineStatusMap((prev) => ({
            ...prev,
            [conversationId]: !!otherUserPresence,
          }));
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          // Other user joined the chat - check if they're actively online
          const joinedPresence = newPresences.find(
            (p: any) => p.user_id === otherUserId && p.online === true
          );
          if (joinedPresence) {
            setOnlineStatusMap((prev) => ({
              ...prev,
              [conversationId]: true,
            }));
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          // Other user left the chat
          if (leftPresences.some((p: any) => p.user_id === otherUserId)) {
            setOnlineStatusMap((prev) => ({
              ...prev,
              [conversationId]: false,
            }));
          }
        })
        .on('presence', { event: 'update' }, ({ key, newPresences }) => {
          // Presence updated (e.g., online status changed)
          const updatedPresence = newPresences.find(
            (p: any) => p.user_id === otherUserId
          );
          if (updatedPresence) {
            setOnlineStatusMap((prev) => ({
              ...prev,
              [conversationId]: updatedPresence.online === true,
            }));
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Track current user as present (but not actively in chat, just subscribed to presence)
            // We don't set online: true here because we only want to show online when they're IN the chat
            await presenceChannel.track({
              user_id: user.id,
              user_name: user.fullName,
              online: false, // Not actively in chat, just monitoring presence
              typing: false,
            });
          }
        });

      presenceChannelsRef.current[conversationId] = presenceChannel;
    });

    // Cleanup: Unsubscribe from all presence channels
    return () => {
      Object.values(presenceChannelsRef.current).forEach((channel) => {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      });
      presenceChannelsRef.current = {};
      setOnlineStatusMap({});
    };
  }, [conversations, user]);

  const getOtherUser = (conversation: Conversation) => {
    return conversation.participantDetails.find((p) => p.id !== user?.id);
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherUser = getOtherUser(item);
    if (!otherUser) return null;

    // Use presence-based online status instead of database field
    const isOnline = onlineStatusMap[item.id] || false;

    return (
      <TouchableOpacity
        style={[styles.conversationCard, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
        onPress={() => router.push({
          pathname: '/conversation/[id]',
          params: { id: item.id }
        } as any)}
        onLongPress={() => handleDeleteConversation(item.id, otherUser.fullName)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <UserAvatar
            avatarUrl={otherUser.avatarUrl || null}
            fullName={otherUser.fullName}
            size={50}
            role={otherUser.role || 'volunteer'}
            membershipTier={otherUser.membershipTier || 'free'}
            membershipStatus={otherUser.membershipStatus || 'inactive'}
            isPartnerOrganization={otherUser.is_partner_organization}
          />
          {isOnline && (
            <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
              <OnlineStatusDot isOnline={true} size={14} />
            </View>
          )}
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <View style={styles.userNameContainer}>
              <UserNameWithBadge
                name={otherUser.fullName}
                role={otherUser.role || 'volunteer'}
                membershipTier={otherUser.membershipTier || 'free'}
                membershipStatus={otherUser.membershipStatus || 'inactive'}
                isPartnerOrganization={otherUser.is_partner_organization}
                style={[styles.userName, { color: colors.text }]}
              />
            </View>
            {item.lastMessage && (
              <Text style={[styles.timestamp, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatTimeAgo(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>
          {item.lastMessage ? (
            <Text
              style={[
                styles.lastMessage,
                { color: item.unreadCount > 0 ? colors.text : colors.textSecondary },
                item.unreadCount > 0 && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage.senderId === user?.id ? 'You: ' : ''}
              {item.lastMessage.text}
            </Text>
          ) : (
            <Text style={[styles.noMessages, { color: colors.textSecondary }]}>No messages yet</Text>
          )}
        </View>

        <View style={styles.chevron}>
          <Text style={[styles.chevronText, { color: colors.textSecondary }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <Head>
          <title>Messages | VIbe</title>
        </Head>
        {/* Header with SafeAreaInsets */}
        {!isDesktop && (
          <View style={[
            styles.header,
            { paddingTop: insets.top + 16, backgroundColor: colors.background, borderBottomColor: colors.border }
          ]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
          </View>
        )}

        <WebContainer>
          {/* Conversations List */}
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 20 }
            ]}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refreshConversations}
                tintColor={colors.tint}
              />
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.listContent}>
                  <ConversationsSkeleton count={4} />
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>No messages yet</Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Connect with other volunteers to start chatting
                  </Text>
                </View>
              )
            }
          />
        </WebContainer>
      </View>

      {/* Custom Alert */}
      <CustomAlert {...alertProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  listContent: {
    flexGrow: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
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
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 6,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  userNameContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    flexShrink: 0,
  },
  lastMessage: {
    fontSize: 14,
  },
  lastMessageUnread: {
    fontWeight: '600',
  },
  noMessages: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  chevron: {
    marginLeft: 8,
  },
  chevronText: {
    fontSize: 24,
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