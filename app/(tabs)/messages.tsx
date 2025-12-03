/**
 * Messages Tab Screen
 * Conversational inbox with search, filters, and rich previews
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  useColorScheme,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Plus, X, Inbox } from 'lucide-react-native';

import { Colors } from '../../constants/colors';
import { useMessaging } from '../../contexts/MessagingContext';
import { useAuth } from '../../contexts/AuthContext';
import WebContainer from '../../components/WebContainer';
import { EmptyState } from '../../components/EmptyState';
import { UserAvatar, UserNameWithBadge, OnlineStatusDot, MessageStatus } from '../../components';
import type { Conversation } from '../../types';
import { isUserOnline } from '../../utils/userStatus';

const FILTERS: { id: 'all' | 'unread'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

const PLACEHOLDER_ITEMS = Array.from({ length: 6 }).map((_, index) => index);

type ColorTheme = typeof Colors.light;

type ConversationRowProps = {
  conversation: Conversation;
  colors: ColorTheme;
  currentUserId?: string;
  onPress: (conversationId: string) => void;
};

const getOtherParticipant = (conversation: Conversation, userId?: string) => {
  return (
    conversation.participantDetails.find((participant) => participant.id !== userId) ||
    conversation.participantDetails[0]
  );
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const dayMs = 86_400_000;
  if (diffMs < dayMs) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (diffMs < dayMs * 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const MARKERS = ['__REPLY_TO__:', '__ATTACHMENTS__:'] as const;

const stripAfterMarker = (text: string, marker: string) => {
  const index = text.indexOf(marker);
  return index >= 0 ? text.slice(0, index) : text;
};

const parseMessagePreview = (rawText?: string) => {
  if (!rawText) {
    return { text: '', hasAttachment: false, hasReply: false };
  }

  const hasReply = rawText.includes('__REPLY_TO__');
  const hasAttachment = rawText.includes('__ATTACHMENTS__');

  let cleaned = rawText;
  MARKERS.forEach((marker) => {
    cleaned = stripAfterMarker(cleaned, marker);
  });

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return {
    text: cleaned,
    hasAttachment,
    hasReply,
  };
};

const ConversationSkeleton = ({ colors }: { colors: ColorTheme }) => (
  <View style={[styles.conversationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
    {/* avatar + text placeholder */}
    <View style={[styles.avatarSkeleton, { backgroundColor: colors.skeleton }]} />
    <View style={styles.skeletonContent}>
      <View style={[styles.textSkeleton, { width: '55%', backgroundColor: colors.skeleton }]} />
      <View style={[styles.textSkeleton, { width: '35%', backgroundColor: colors.skeleton }]} />
      <View style={[styles.textSkeleton, { width: '80%', backgroundColor: colors.skeleton }]} />
    </View>
  </View>
);

const ConversationRow = ({ conversation, colors, currentUserId, onPress }: ConversationRowProps) => {
  const otherUser = getOtherParticipant(conversation, currentUserId);
  const lastMessage = conversation.lastMessage;
  const lastMessageFromCurrentUser = lastMessage?.senderId === currentUserId;
  const preview = parseMessagePreview(lastMessage?.text);

  const fallbackPreview = preview.hasAttachment
    ? 'Shared an attachment'
    : preview.hasReply
    ? 'Replied to a message'
    : 'Say hello to get things started';

  const previewText = preview.text || fallbackPreview;
  const previewAuthor = lastMessage
    ? lastMessageFromCurrentUser
      ? 'You'
      : otherUser?.fullName?.split(' ')[0] || 'Volunteer'
    : otherUser?.fullName || 'Volunteer';

  return (
    <Pressable
      onPress={() => onPress(conversation.id)}
      style={({ pressed }) => [
        styles.conversationCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        pressed && styles.conversationCardPressed,
      ]}
      android_ripple={{ color: colors.ripple }}
    >
      <View style={styles.avatarWrapper}>
        <UserAvatar
          fullName={otherUser?.fullName || 'User'}
          avatarUrl={otherUser?.avatarUrl}
          membershipTier={otherUser?.membershipTier as any}
          membershipStatus={otherUser?.membershipStatus as any}
          role={otherUser?.role}
          size={56}
        />
        <OnlineStatusDot
          isOnline={isUserOnline(otherUser?.lastSeen)}
          style={styles.onlineDot}
        />
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeaderRow}>
          <UserNameWithBadge
            fullName={otherUser?.fullName || 'Conversation'}
            membershipTier={otherUser?.membershipTier as any}
            membershipStatus={otherUser?.membershipStatus as any}
            role={otherUser?.role}
            numberOfLines={1}
            fontSize={16}
            style={styles.nameWrapper}
          />
          <Text style={[styles.timestamp, { color: colors.textTertiary }]}> 
            {formatTimestamp(lastMessage?.createdAt || conversation.updatedAt)}
          </Text>
        </View>

        <View style={styles.previewRow}>
          {lastMessageFromCurrentUser && lastMessage?.status && (
            <MessageStatus status={lastMessage.status} size={14} />
          )}
          <Text
            style={[styles.previewText, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {previewAuthor}: {previewText}
          </Text>
        </View>

        <View style={styles.previewMetaRow}>
          {preview.hasAttachment && (
            <View style={[styles.attachmentBadge, { backgroundColor: colors.surfaceElevated }]}> 
              <Text style={[styles.attachmentText, { color: colors.textSecondary }]}>Attachment</Text>
            </View>
          )}
          {conversation.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}> 
              <Text style={styles.unreadText}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default function MessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversations, loading, refreshConversations, updateOnlineStatus } = useMessaging();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Update last_seen when screen is focused
  useFocusEffect(
    useCallback(() => {
      refreshConversations();
      
      // Set user as online and update last_seen
      updateOnlineStatus(true);
      
      // Update last_seen every 30 seconds while on this screen
      const interval = setInterval(() => {
        updateOnlineStatus(true);
      }, 30000); // 30 seconds
      
      // Cleanup: set user as offline when leaving screen
      return () => {
        clearInterval(interval);
        updateOnlineStatus(false);
      };
    }, [refreshConversations, updateOnlineStatus])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const filteredConversations = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (activeFilter === 'unread' && conversation.unreadCount === 0) {
        return false;
      }

      if (!term) return true;

      const other = getOtherParticipant(conversation, user?.id);
      const haystack = [
        other?.fullName,
        other?.email,
        conversation.lastMessage?.text,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeFilter, conversations, searchQuery, user?.id]);

  const showSkeleton = loading && conversations.length === 0;

  const renderConversation = ({ item }: { item: Conversation }) => (
    <ConversationRow
      conversation={item}
      colors={colors}
      currentUserId={user?.id}
      onPress={(conversationId) =>
        router.push({ pathname: '/conversation/[id]', params: { id: conversationId } })
      }
    />
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { backgroundColor: colors.background }]}> 
        <WebContainer>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
            <View style={styles.headerTextGroup}>
              <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Stay in sync with causes, volunteers, and partners.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/search')}
              style={({ pressed }) => [
                styles.newButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start a new chat"
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.newButtonText}>New chat</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrapper}>
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Search size={18} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search people or messages"
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <Pressable
                  key={filter.id}
                  onPress={() => setActiveFilter(filter.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? colors.primarySoft : colors.surfaceElevated,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      { color: isActive ? colors.primaryDark : colors.textSecondary },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showSkeleton ? (
            <View style={styles.skeletonList}>
              {PLACEHOLDER_ITEMS.map((item) => (
                <ConversationSkeleton colors={colors} key={`skeleton-${item}`} />
              ))}
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => item.id}
              renderItem={renderConversation}
              contentContainerStyle={[
                styles.listContent,
                filteredConversations.length === 0 && styles.emptyListContent,
                { paddingBottom: Math.max(insets.bottom + 16, 32) },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  icon={Inbox}
                  title={searchQuery ? 'No results found' : 'No conversations yet'}
                  subtitle={
                    searchQuery
                      ? 'Try a different name or keyword.'
                      : 'Start a conversation with a volunteer or organization.'
                  }
                  action={{
                    label: 'Find people to message',
                    onPress: () => router.push('/search'),
                  }}
                  suggestions={
                    searchQuery
                      ? ['Search by cause, organization, or name']
                      : ['Explore the feed and tap message', 'Invite teammates to chat']
                  }
                  colors={colors}
                />
              }
            />
          )}
        </WebContainer>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchWrapper: {
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 10, default: 4 }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  conversationCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  avatarWrapper: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
  conversationContent: {
    flex: 1,
    gap: 6,
  },
  conversationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nameWrapper: {
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  attachmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 24,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  skeletonList: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  avatarSkeleton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
  textSkeleton: {
    height: 14,
    borderRadius: 7,
  },
});
