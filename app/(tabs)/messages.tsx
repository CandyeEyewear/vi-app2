/**
 * Messages Tab Screen
 * Lists all conversations
 */

import React from 'react';
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

export default function MessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, loading, refreshConversations, deleteConversation } = useMessaging();
  const { alertProps, showAlert } = useAlert();

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

  const getOtherUser = (conversation: Conversation) => {
    return conversation.participantDetails.find((p) => p.id !== user?.id);
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherUser = getOtherUser(item);
    if (!otherUser) return null;

    return (
      <TouchableOpacity
        style={[styles.conversationCard, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
        onPress={() => router.push(`/conversation/${item.id}`)}
        onLongPress={() => handleDeleteConversation(item.id, otherUser.fullName)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {otherUser.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
              <Text style={styles.avatarText}>
                {otherUser.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {otherUser.onlineStatus && (
            <OnlineStatusDot isOnline={true} size={14} />
          )}
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {otherUser.fullName}
            </Text>
            {item.lastMessage && (
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
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
        {/* Header with SafeAreaInsets */}
        <View style={[
          styles.header,
          { paddingTop: insets.top + 16, backgroundColor: colors.background, borderBottomColor: colors.border }
        ]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        </View>

        {/* Conversations List */}
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refreshConversations}
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
                <Text style={[styles.emptyText, { color: colors.text }]}>No messages yet</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Connect with other volunteers to start chatting
                </Text>
              </View>
            )
          }
        />
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
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 8,
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