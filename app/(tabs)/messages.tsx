/**
 * Messages Tab Screen
 * Lists all conversations with modern UI
 * 
 * Modern UI with:
 * - Responsive design (mobile app, mobile web, desktop)
 * - Animated conversation cards with press feedback
 * - Swipe actions for delete/archive
 * - Pulsing unread badges
 * - Glowing online indicators
 * - Shimmer loading states
 * - Beautiful empty state
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
  Platform,
  useWindowDimensions,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronRight, 
  MessageCircle, 
  Trash2, 
  Archive, 
  Bell, 
  BellOff,
  Edit3,
  Search,
} from 'lucide-react-native';
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

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================
const getResponsiveValues = () => {
  const width = Dimensions.get('window').width;
  
  const isSmallMobile = width < 380;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  return {
    isSmallMobile,
    isMobile,
    isTablet,
    isDesktop,
    maxContentWidth: isDesktop ? 800 : isTablet ? 700 : '100%',
    avatarSize: isSmallMobile ? 48 : 54,
    spacing: {
      xs: isSmallMobile ? 4 : 6,
      sm: isSmallMobile ? 8 : 10,
      md: isSmallMobile ? 12 : 16,
      lg: isSmallMobile ? 16 : 20,
      xl: isSmallMobile ? 20 : 24,
    },
    fontSize: {
      xs: isSmallMobile ? 10 : 11,
      sm: isSmallMobile ? 12 : 13,
      md: isSmallMobile ? 14 : 15,
      lg: isSmallMobile ? 15 : 16,
      xl: isSmallMobile ? 17 : 18,
      header: isSmallMobile ? 22 : isTablet ? 28 : 26,
    },
  };
};

// ============================================================================
// SHIMMER SKELETON
// ============================================================================
function ShimmerEffect({ style, colors }: { style?: any; colors: typeof Colors.light }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[{ backgroundColor: colors.skeleton, opacity }, style]} />
  );
}

// ============================================================================
// CONVERSATION SKELETON
// ============================================================================
function ConversationSkeleton({ colors }: { colors: typeof Colors.light }) {
  const responsive = getResponsiveValues();
  
  return (
    <View style={[styles.conversationCard, { backgroundColor: colors.card }]}>
      <ShimmerEffect 
        colors={colors} 
        style={[styles.skeletonAvatar, { width: responsive.avatarSize, height: responsive.avatarSize }]} 
      />
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <ShimmerEffect colors={colors} style={styles.skeletonName} />
          <ShimmerEffect colors={colors} style={styles.skeletonTime} />
        </View>
        <ShimmerEffect colors={colors} style={styles.skeletonMessage} />
      </View>
    </View>
  );
}

// ============================================================================
// PULSING UNREAD BADGE
// ============================================================================
function UnreadBadge({ count, colors }: { count: number; colors: typeof Colors.light }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, []);

  if (count === 0) return null;

  return (
    <View style={styles.unreadBadgeContainer}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.unreadBadgeGlow,
          {
            backgroundColor: colors.error,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {/* Badge */}
      <Animated.View
        style={[
          styles.unreadBadge,
          {
            backgroundColor: colors.error,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Text style={styles.unreadText}>
          {count > 99 ? '99+' : count}
        </Text>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// ENHANCED ONLINE INDICATOR
// ============================================================================
function OnlineIndicator({ isOnline, colors }: { isOnline: boolean; colors: typeof Colors.light }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isOnline) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();

      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.6,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      glow.start();

      return () => glow.stop();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isOnline]);

  if (!isOnline) return null;

  return (
    <Animated.View
      style={[
        styles.onlineIndicatorContainer,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* Glow ring */}
      <Animated.View
        style={[
          styles.onlineGlow,
          {
            backgroundColor: colors.success,
            opacity: glowAnim,
          },
        ]}
      />
      {/* Dot with ring */}
      <View style={[styles.onlineRing, { borderColor: colors.card }]}>
        <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
      </View>
    </Animated.View>
  );
}

// ============================================================================
// TIME BADGE
// ============================================================================
function TimeBadge({ 
  time, 
  isRecent, 
  colors 
}: { 
  time: string; 
  isRecent: boolean; 
  colors: typeof Colors.light;
}) {
  const responsive = getResponsiveValues();

  if (isRecent) {
    return (
      <View style={[styles.timeBadge, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.timeBadgeText, { color: colors.primary, fontSize: responsive.fontSize.xs }]}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <Text style={[styles.timestamp, { color: colors.textTertiary, fontSize: responsive.fontSize.sm }]}>
      {time}
    </Text>
  );
}

// ============================================================================
// SWIPE ACTIONS
// ============================================================================
function SwipeActionsRight({ 
  onDelete, 
  onArchive, 
  colors 
}: { 
  onDelete: () => void; 
  onArchive: () => void;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.swipeActionsContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.swipeAction,
          { opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={onArchive}
      >
        <LinearGradient
          colors={[colors.warning, colors.warningDark]}
          style={styles.swipeActionGradient}
        >
          <Archive size={22} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>Archive</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.swipeAction,
          { opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={onDelete}
      >
        <LinearGradient
          colors={[colors.error, colors.errorDark || '#B91C1C']}
          style={styles.swipeActionGradient}
        >
          <Trash2 size={22} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ============================================================================
// CONVERSATION CARD
// ============================================================================
const ConversationCard = React.memo(({
  conversation,
  otherUser,
  isOnline,
  currentUserId,
  onPress,
  onDelete,
  colors,
}: {
  conversation: Conversation;
  otherUser: any;
  isOnline: boolean;
  currentUserId: string;
  onPress: () => void;
  onDelete: () => void;
  colors: typeof Colors.light;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef<Swipeable>(null);
  const responsive = getResponsiveValues();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return { text: 'now', isRecent: true };
    if (seconds < 3600) return { text: `${Math.floor(seconds / 60)}m`, isRecent: true };

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return {
        text: date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        isRecent: false,
      };
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return { text: 'Yesterday', isRecent: false };
    }

    if (seconds < 604800) {
      return {
        text: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isRecent: false,
      };
    }

    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isRecent: false,
    };
  };

  const timeInfo = conversation.lastMessage
    ? formatTimeAgo(conversation.lastMessage.createdAt)
    : null;

  const hasUnread = conversation.unreadCount > 0;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <SwipeActionsRight
          onDelete={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
          onArchive={() => {
            swipeableRef.current?.close();
            // Archive functionality - can be implemented later
          }}
          colors={colors}
        />
      )}
      overshootRight={false}
      friction={2}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.conversationCard,
            {
              backgroundColor: pressed ? colors.surfacePressed : colors.card,
            },
          ]}
        >
          {/* Avatar Section */}
          <View style={styles.avatarContainer}>
            <UserAvatar
              avatarUrl={otherUser.avatarUrl || null}
              fullName={otherUser.fullName}
              size={responsive.avatarSize}
              role={otherUser.role || 'volunteer'}
              membershipTier={otherUser.membershipTier || 'free'}
              membershipStatus={otherUser.membershipStatus || 'inactive'}
              isPartnerOrganization={otherUser.is_partner_organization}
            />
            <OnlineIndicator isOnline={isOnline} colors={colors} />
            <UnreadBadge count={conversation.unreadCount} colors={colors} />
          </View>

          {/* Content Section */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.userNameContainer}>
                <UserNameWithBadge
                  name={otherUser.fullName}
                  role={otherUser.role || 'volunteer'}
                  membershipTier={otherUser.membershipTier || 'free'}
                  membershipStatus={otherUser.membershipStatus || 'inactive'}
                  isPartnerOrganization={otherUser.is_partner_organization}
                  style={[
                    styles.userName,
                    { color: colors.text, fontSize: responsive.fontSize.lg },
                  ]}
                />
              </View>
              {timeInfo && (
                <TimeBadge
                  time={timeInfo.text}
                  isRecent={timeInfo.isRecent}
                  colors={colors}
                />
              )}
            </View>

            {/* Last Message Preview */}
            {conversation.lastMessage ? (
              <View style={styles.lastMessageContainer}>
                {conversation.lastMessage.senderId === currentUserId && (
                  <Text style={[styles.youPrefix, { color: colors.primary }]}>You: </Text>
                )}
                <Text
                  style={[
                    styles.lastMessage,
                    {
                      color: hasUnread ? colors.text : colors.textSecondary,
                      fontWeight: hasUnread ? '600' : '400',
                      fontSize: responsive.fontSize.md,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {conversation.lastMessage.text}
                </Text>
              </View>
            ) : (
              <Text style={[styles.noMessages, { color: colors.textTertiary, fontSize: responsive.fontSize.md }]}>
                No messages yet
              </Text>
            )}
          </View>

          {/* Chevron */}
          <View style={styles.chevronContainer}>
            <ChevronRight size={20} color={colors.textTertiary} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Inset Divider */}
      <View style={[styles.divider, { backgroundColor: colors.divider, marginLeft: responsive.avatarSize + 28 }]} />
    </Swipeable>
  );
});

// ============================================================================
// EMPTY STATE
// ============================================================================
function EmptyState({ colors, onNewMessage }: { colors: typeof Colors.light; onNewMessage?: () => void }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const responsive = getResponsiveValues();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -10,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primarySoft }]}>
        <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
          <MessageCircle size={48} color={colors.primary} strokeWidth={1.5} />
        </Animated.View>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text, fontSize: responsive.fontSize.xl }]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontSize: responsive.fontSize.md }]}>
        Connect with other volunteers to start chatting
      </Text>
      {onNewMessage && (
        <Pressable
          onPress={onNewMessage}
          style={({ pressed }) => [
            styles.emptyButton,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.emptyButtonGradient}
          >
            <Edit3 size={18} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Start a Conversation</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

// ============================================================================
// HEADER BUTTON
// ============================================================================
function HeaderButton({
  onPress,
  children,
  colors,
}: {
  onPress: () => void;
  children: React.ReactNode;
  colors: typeof Colors.light;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.headerButton,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function MessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const responsive = getResponsiveValues();
  const isDesktop = Platform.OS === 'web' && width >= 992;
  const { user } = useAuth();
  const { conversations, loading, refreshConversations, deleteConversation } = useMessaging();
  const { alertProps, showAlert } = useAlert();

  // Track online status per conversation
  const [onlineStatusMap, setOnlineStatusMap] = useState<Record<string, boolean>>({});
  const presenceChannelsRef = useRef<Record<string, any>>({});

  // Presence channel setup
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const conversationChannels = conversations
      .map((conv) => {
        const otherUser = conv.participantDetails.find((p) => p.id !== user.id);
        return { conversationId: conv.id, otherUserId: otherUser?.id };
      })
      .filter((item) => item.otherUserId);

    conversationChannels.forEach(({ conversationId, otherUserId }) => {
      if (presenceChannelsRef.current[conversationId]) return;

      const presenceChannel = supabase.channel(`presence:${conversationId}`, {
        config: { presence: { key: user.id } },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const presences = Object.values(state).flat() as any[];
          const otherUserPresence = presences.find(
            (p: any) => p.user_id === otherUserId && p.online === true
          );
          setOnlineStatusMap((prev) => ({
            ...prev,
            [conversationId]: !!otherUserPresence,
          }));
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          const joinedPresence = newPresences.find(
            (p: any) => p.user_id === otherUserId && p.online === true
          );
          if (joinedPresence) {
            setOnlineStatusMap((prev) => ({ ...prev, [conversationId]: true }));
          }
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          if (leftPresences.some((p: any) => p.user_id === otherUserId)) {
            setOnlineStatusMap((prev) => ({ ...prev, [conversationId]: false }));
          }
        })
        .on('presence', { event: 'update' }, ({ newPresences }) => {
          const updatedPresence = newPresences.find((p: any) => p.user_id === otherUserId);
          if (updatedPresence) {
            setOnlineStatusMap((prev) => ({
              ...prev,
              [conversationId]: updatedPresence.online === true,
            }));
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: user.id,
              user_name: user.fullName,
              online: false,
              typing: false,
            });
          }
        });

      presenceChannelsRef.current[conversationId] = presenceChannel;
    });

    return () => {
      Object.values(presenceChannelsRef.current).forEach((channel) => {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      });
      presenceChannelsRef.current = {};
      setOnlineStatusMap({});
    };
  }, [conversations, user]);

  const getOtherUser = useCallback(
    (conversation: Conversation) => {
      return conversation.participantDetails.find((p) => p.id !== user?.id);
    },
    [user?.id]
  );

  const handleDeleteConversation = useCallback(
    (conversationId: string, userName: string) => {
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
    },
    [deleteConversation, showAlert]
  );

  const handleConversationPress = useCallback(
    (conversationId: string) => {
      router.push({
        pathname: '/conversation/[id]',
        params: { id: conversationId },
      } as any);
    },
    [router]
  );

  const renderConversation = useCallback(
    ({ item }: { item: Conversation }) => {
      const otherUser = getOtherUser(item);
      if (!otherUser) return null;

      const isOnline = onlineStatusMap[item.id] || false;

      return (
        <ConversationCard
          conversation={item}
          otherUser={otherUser}
          isOnline={isOnline}
          currentUserId={user?.id || ''}
          onPress={() => handleConversationPress(item.id)}
          onDelete={() => handleDeleteConversation(item.id, otherUser.fullName)}
          colors={colors}
        />
      );
    },
    [getOtherUser, onlineStatusMap, user?.id, handleConversationPress, handleDeleteConversation, colors]
  );

  const renderEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <ConversationSkeleton key={i} colors={colors} />
          ))}
        </View>
      );
    }

    return <EmptyState colors={colors} />;
  }, [loading, colors]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Head>
          <title>Messages | VIbe</title>
        </Head>

        {/* Header */}
        {!isDesktop && (
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
            <View style={styles.headerContent}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: colors.text, fontSize: responsive.fontSize.header },
                ]}
              >
                Messages
              </Text>
              <View style={styles.headerActions}>
                <HeaderButton onPress={() => {}} colors={colors}>
                  <Search size={20} color={colors.text} />
                </HeaderButton>
              </View>
            </View>
          </View>
        )}

        <WebContainer>
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 20 },
              conversations.length === 0 && styles.listContentEmpty,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={loading && conversations.length > 0}
                onRefresh={refreshConversations}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={renderEmptyComponent}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </WebContainer>
      </View>

      <CustomAlert {...alertProps} />
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // List
  listContent: {
    flexGrow: 1,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Conversation Card
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  userNameContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  userName: {
    fontWeight: '600',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  youPrefix: {
    fontSize: 14,
    fontWeight: '500',
  },
  lastMessage: {
    flex: 1,
  },
  noMessages: {
    fontStyle: 'italic',
  },
  chevronContainer: {
    marginLeft: 8,
    opacity: 0.5,
  },
  divider: {
    height: 1,
  },

  // Time Badge
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timeBadgeText: {
    fontWeight: '600',
  },
  timestamp: {
    flexShrink: 0,
  },

  // Unread Badge
  unreadBadgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Online Indicator
  onlineIndicatorContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineGlow: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  onlineRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },

  // Swipe Actions
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  swipeActionGradient: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
  },
  skeletonAvatar: {
    borderRadius: 27,
    marginRight: 14,
  },
  skeletonName: {
    width: 120,
    height: 16,
    borderRadius: 8,
  },
  skeletonTime: {
    width: 40,
    height: 12,
    borderRadius: 6,
  },
  skeletonMessage: {
    width: '80%',
    height: 14,
    borderRadius: 7,
    marginTop: 8,
  },
});  const slideAnim = useRef(new Animated.Value(0)).current;
  const [tabWidths, setTabWidths] = useState<number[]>([]);
  const [tabPositions, setTabPositions] = useState<number[]>([]);
  const responsive = getResponsiveValues();

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  useEffect(() => {
    if (tabPositions.length > 0 && tabWidths.length > 0) {
      Animated.spring(slideAnim, {
        toValue: tabPositions[activeIndex] || 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, tabPositions, tabWidths]);

  const handleTabLayout = (index: number, event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setTabWidths(prev => {
      const newWidths = [...prev];
      newWidths[index] = width;
      return newWidths;
    });
    setTabPositions(prev => {
      const newPositions = [...prev];
      newPositions[index] = x;
      return newPositions;
    });
  };

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabWidths.length === tabs.length && (
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                backgroundColor: colors.primary,
                width: tabWidths[activeIndex] || 100,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />
        )}

        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onLayout={(e) => handleTabLayout(index, e)}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
              onPress={() => onTabChange(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary, fontSize: responsive.fontSize.md },
                  isActive && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

// ============================================================================
// ENHANCED SEARCH BAR COMPONENT
// ============================================================================
const EnhancedSearchBar = React.memo(({ 
  searchQuery, 
  onSearchChange, 
  onClearSearch, 
  searchInputRef,
  colors,
  onFocus,
  onBlur,
  onHideSuggestions,
  onLayout,
  searchBarRef,
}: {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  searchInputRef: React.RefObject<TextInput | null>;
  colors: typeof Colors.light;
  onFocus: () => void;
  onBlur: () => void;
  onHideSuggestions: () => void;
  onLayout?: (event: any) => void;
  searchBarRef?: React.RefObject<View | null>;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const responsive = getResponsiveValues();

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const handleFocus = () => {
    setIsFocused(true);
    onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur();
  };

  return (
    <View ref={searchBarRef as any} onLayout={onLayout} style={styles.searchWrapper}>
      <Animated.View 
        style={[
          styles.searchContainer, 
          { 
            backgroundColor: colors.card, 
            borderColor,
            borderWidth: isFocused ? 2 : 1,
            height: responsive.searchHeight,
          }
        ]}
      >
        <Search 
          size={20} 
          color={isFocused ? colors.primary : colors.textSecondary} 
          style={styles.searchIcon} 
        />
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { color: colors.text, fontSize: responsive.fontSize.md }]}
          placeholder="Search opportunities..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={onSearchChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (searchQuery.trim()) {
              Keyboard.dismiss();
              onHideSuggestions();
            }
          }}
        />
        {searchQuery.length > 0 && (
          <Pressable 
            onPress={onClearSearch}
            style={({ pressed }) => [
              styles.clearButton,
              { backgroundColor: colors.surfaceElevated },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
          >
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
});

// ============================================================================
// ANIMATED SUGGESTIONS DROPDOWN
// ============================================================================
const SuggestionsDropdown = React.memo(({
  visible,
  suggestions,
  colors,
  onSelectSuggestion,
  topPosition,
}: {
  visible: boolean;
  suggestions: string[];
  colors: typeof Colors.light;
  onSelectSuggestion: (suggestion: string) => void;
  topPosition: number;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  const showDropdown = visible && suggestions.length > 0;

  useEffect(() => {
    if (showDropdown) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [showDropdown]);

  if (!showDropdown) return null;

  return (
    <Animated.View 
      style={[
        styles.suggestionsDropdownWrapper, 
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          top: topPosition,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          shadowColor: colors.shadow,
        }
      ]}
    >
      <View style={styles.suggestionsContainer}>
        <View style={[styles.suggestionsHeader, { borderBottomColor: colors.divider }]}>
          <Search size={14} color={colors.primary} />
          <Text style={[styles.suggestionsHeaderText, { color: colors.textSecondary }]}>Suggestions</Text>
        </View>
        {suggestions.map((suggestion, index) => (
          <Pressable
            key={`suggestion-${index}`}
            style={({ pressed }) => [
              styles.suggestionItem,
              { borderBottomColor: colors.divider },
              pressed && { backgroundColor: colors.surfacePressed },
              index === suggestions.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => onSelectSuggestion(suggestion)}
          >
            <View style={[styles.suggestionIconContainer, { backgroundColor: colors.primarySoft }]}>
              <Search size={14} color={colors.primary} />
            </View>
            <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
});

// ============================================================================
// ANIMATED FILTER CHIP COMPONENT
// ============================================================================
const AnimatedFilterChip = React.memo(({
  label,
  isSelected,
  onPress,
  colors,
  icon: Icon,
  count,
  showMapPin,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
  icon?: any;
  count?: number;
  showMapPin?: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const responsive = getResponsiveValues();

  useEffect(() => {
    Animated.timing(bgAnim, { toValue: isSelected ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.card, colors.primary],
  });

  const borderColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View
          style={[styles.filterChip, { backgroundColor, borderColor, height: responsive.chipHeight }]}
        >
          {isSelected && (
            <View style={styles.chipCheckmark}>
              <Check size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
          )}
          {showMapPin && <MapPin size={14} color={isSelected ? '#FFFFFF' : colors.text} style={{ marginRight: 4 }} />}
          {Icon && <Icon size={14} color={isSelected ? '#FFFFFF' : colors.text} style={{ marginRight: 4 }} />}
          <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : colors.text }, isSelected && styles.filterChipTextSelected]}>
            {label}
          </Text>
          {count !== undefined && count > 0 && (
            <View style={[styles.filterChipBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.primary }]}>
              <Text style={styles.filterChipBadgeText}>{count}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================================
// FILTER PANEL COMPONENT
// ============================================================================
const FilterPanel = React.memo(({
  visible,
  onClose,
  colors,
  dateRange,
  onDateRangeChange,
  maxDistance,
  onMaxDistanceChange,
  minSpotsAvailable,
  onMinSpotsAvailableChange,
  organizationVerified,
  onOrganizationVerifiedChange,
  sortBy,
  onSortByChange,
}: {
  visible: boolean;
  onClose: () => void;
  colors: typeof Colors.light;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  maxDistance: number | undefined;
  onMaxDistanceChange: (value: number | undefined) => void;
  minSpotsAvailable: number | undefined;
  onMinSpotsAvailableChange: (value: number | undefined) => void;
  organizationVerified: boolean | undefined;
  onOrganizationVerifiedChange: (value: boolean | undefined) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.filterPanelHeader}>
        <View style={styles.filterPanelTitleContainer}>
          <SlidersHorizontal size={18} color={colors.primary} />
          <Text style={[styles.filterPanelTitle, { color: colors.text }]}>Filters</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.filterCloseButton, { backgroundColor: colors.surfaceElevated }, pressed && { opacity: 0.7 }]}
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Sort By</Text>
          <View style={styles.filterOptions}>
            {SORT_OPTIONS.map(option => (
              <AnimatedFilterChip key={option.value} label={option.label} isSelected={sortBy === option.value} onPress={() => onSortByChange(option.value)} colors={colors} />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Date Range</Text>
          <View style={styles.filterOptions}>
            {DATE_RANGE_OPTIONS.map(option => (
              <AnimatedFilterChip key={option.value} label={option.label} isSelected={dateRange === option.value} onPress={() => onDateRangeChange(option.value)} colors={colors} />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Maximum Distance</Text>
          <View style={styles.filterOptions}>
            {[5, 10, 25, 50, 100].map(distance => (
              <AnimatedFilterChip key={distance} label={`${distance} mi`} isSelected={maxDistance === distance} onPress={() => onMaxDistanceChange(maxDistance === distance ? undefined : distance)} colors={colors} />
            ))}
            <AnimatedFilterChip label="Any" isSelected={maxDistance === undefined} onPress={() => onMaxDistanceChange(undefined)} colors={colors} />
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Minimum Spots</Text>
          <View style={styles.filterOptions}>
            {[1, 5, 10, 20].map(spots => (
              <AnimatedFilterChip key={spots} label={`${spots}+`} isSelected={minSpotsAvailable === spots} onPress={() => onMinSpotsAvailableChange(minSpotsAvailable === spots ? undefined : spots)} colors={colors} />
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Organization</Text>
          <View style={styles.filterOptions}>
            <AnimatedFilterChip label="Verified Only" isSelected={organizationVerified === true} onPress={() => onOrganizationVerifiedChange(organizationVerified === true ? undefined : true)} colors={colors} icon={CheckCircle} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

// ============================================================================
// LOCATION BANNER COMPONENT
// ============================================================================
const LocationBanner = React.memo(({ type, colors, onEnable }: { type: 'permission' | 'loading'; colors: typeof Colors.light; onEnable?: () => void }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (type === 'loading') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [type]);

  if (type === 'loading') {
    return (
      <View style={[styles.locationBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MapPin size={18} color={colors.primary} />
        </Animated.View>
        <Text style={[styles.locationBannerText, { color: colors.text }]}>Getting your location...</Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.locationBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
      <MapPin size={18} color={colors.warning} />
      <Text style={[styles.locationBannerText, { color: colors.warningText }]}>Enable location to see nearby opportunities</Text>
      <Pressable onPress={onEnable} style={({ pressed }) => [styles.enableLocationButton, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
        <LinearGradient colors={[colors.warning, colors.warningDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.enableLocationGradient}>
          <Text style={styles.enableLocationButtonText}>Enable</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
});

// ============================================================================
// SWIPE ACTION COMPONENT
// ============================================================================
const SwipeActions = React.memo(({ isSaved, onSave, onShare, colors }: { isSaved: boolean; onSave: () => void; onShare: () => void; colors: typeof Colors.light }) => (
  <View style={styles.swipeActionsContainer}>
    <Pressable style={({ pressed }) => [styles.swipeAction, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} onPress={onSave}>
      <LinearGradient colors={isSaved ? [colors.warning, colors.warningDark] : [colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.swipeActionGradient}>
        <Bookmark size={24} color="#FFFFFF" fill={isSaved ? "#FFFFFF" : "none"} />
        <Text style={styles.swipeActionText}>{isSaved ? 'Saved' : 'Save'}</Text>
      </LinearGradient>
    </Pressable>
    <Pressable style={({ pressed }) => [styles.swipeAction, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} onPress={onShare}>
      <LinearGradient colors={[colors.success, colors.successDark]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.swipeActionGradient}>
        <Share2 size={24} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Share</Text>
      </LinearGradient>
    </Pressable>
  </View>
));

// ============================================================================
// HEADER COMPONENT
// ============================================================================
const ScreenHeader = React.memo(({ colors, insets, onSearchPress }: { colors: typeof Colors.light; insets: { top: number }; onSearchPress: () => void }) => {
  const responsive = getResponsiveValues();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => { Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start(); };
  const handlePressOut = () => { Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start(); };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: responsive.fontSize.title }]}>Discover</Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable onPress={onSearchPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.searchIconButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Search size={22} color={colors.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
});

// ============================================================================
// LOADING FOOTER
// ============================================================================
const LoadingFooter = React.memo(({ colors }: { colors: typeof Colors.light }) => (
  <View style={styles.loadingMoreContainer}>
    <View style={[styles.loadingMoreContent, { backgroundColor: colors.surfaceElevated }]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>Loading more...</Text>
    </View>
  </View>
));

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function DiscoverScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const responsive = getResponsiveValues();
  const isDesktop = Platform.OS === 'web' && width >= 992;
  const { isAdmin, user } = useAuth();
  
  const searchInputRef = useRef<TextInput | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<FlatList>(null);
  const searchBarRef = useRef<View | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  
  const [searchBarLayout, setSearchBarLayout] = useState({ y: 0, height: 0 });
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<OpportunityCategory | 'all' | 'nearMe'>((params.category as any) || 'all');
  const [searchQuery, setSearchQuery] = useState((params.query as string) || '');
  const [searchInputValue, setSearchInputValue] = useState((params.query as string) || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<string[]>([]);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'opportunities' | 'causes' | 'events'>('opportunities');
  const [tabCache, setTabCache] = useState({ opportunities: true, causes: false, events: false });
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<string>('all');
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined);
  const [minSpotsAvailable, setMinSpotsAvailable] = useState<number | undefined>(undefined);
  const [organizationVerified, setOrganizationVerified] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  // Load search history
  const loadSearchHistory = async () => { setSearchHistory(await getSearchHistory()); };
  useEffect(() => { loadSearchHistory(); }, []);

  // Load saved opportunity IDs
  const loadSavedOpportunityIds = useCallback(async () => {
    if (!user?.id) { setSavedOpportunityIds([]); return; }
    try {
      const { data, error } = await supabase.from('saved_opportunities').select('opportunity_id').eq('user_id', user.id);
      if (error) throw error;
      setSavedOpportunityIds(data?.map(item => item.opportunity_id) || []);
    } catch (error) { console.error('Error loading saved opportunities:', error); setSavedOpportunityIds([]); }
  }, [user?.id]);

  useEffect(() => { user?.id ? loadSavedOpportunityIds() : setSavedOpportunityIds([]); }, [user?.id, loadSavedOpportunityIds]);

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Get user location
  const getUserLocation = async () => {
    try {
      setRequestingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationPermission(false); setRequestingLocation(false); return; }
      setLocationPermission(true);
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (error) { console.error('Error getting location:', error); setLocationPermission(false); } 
    finally { setRequestingLocation(false); }
  };

  useEffect(() => { if (selectedCategory === 'nearMe' && !userLocation && !requestingLocation) getUserLocation(); }, [selectedCategory]);

  // Load opportunities
  const loadOpportunities = async (append: boolean = false) => {
    try {
      if (!append) { setLoading(true); setError(null); } else { setLoadingMore(true); }

      let isPremiumMember = false, isAdminUser = false;
      if (user?.id) {
        const { data: userData } = await supabase.from('users').select('membership_tier, membership_status, role').eq('id', user.id).single();
        isPremiumMember = userData?.membership_tier === 'premium' && userData?.membership_status === 'active';
        isAdminUser = userData?.role === 'admin';
      }

      let query = supabase.from('opportunities').select('*').eq('status', 'active').or('proposal_status.is.null,proposal_status.eq.approved');
      if (!isAdminUser && !isPremiumMember) query = query.or('visibility.is.null,visibility.eq.public');
      if (selectedCategory !== 'all' && selectedCategory !== 'nearMe') query = query.eq('category', selectedCategory);
      query = query.order('date', { ascending: true });
      if (append) query = query.range(opportunities.length, opportunities.length + PAGE_SIZE - 1);
      else query = query.limit(PAGE_SIZE);

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      const opportunitiesData: Opportunity[] = (data || []).map((opp) => ({
        id: opp.id, title: opp.title, description: opp.description, organizationName: opp.organization_name,
        organizationVerified: opp.organization_verified, category: opp.category, location: opp.location,
        latitude: opp.latitude, longitude: opp.longitude, mapLink: opp.map_link, date: opp.date,
        dateStart: opp.date_start, dateEnd: opp.date_end, timeStart: opp.time_start, timeEnd: opp.time_end,
        duration: opp.duration, spotsAvailable: opp.spots_available, spotsTotal: opp.spots_total,
        requirements: opp.requirements, skillsNeeded: opp.skills_needed, impactStatement: opp.impact_statement,
        imageUrl: opp.image_url, status: opp.status, visibility: opp.visibility || 'public',
        createdBy: opp.created_by, createdAt: opp.created_at, updatedAt: opp.updated_at,
        distance: userLocation && opp.latitude && opp.longitude ? calculateDistance(userLocation.latitude, userLocation.longitude, opp.latitude, opp.longitude) : undefined,
      }));

      const today = new Date(); today.setHours(0, 0, 0, 0);
      let filteredData = isAdminUser ? opportunitiesData : opportunitiesData.filter((opp) => {
        const oppDate = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null;
        if (!oppDate) return true;
        const oppDateEnd = new Date(oppDate); oppDateEnd.setHours(23, 59, 59, 999);
        return oppDateEnd >= today;
      });

      if (append) { setOpportunities(prev => [...prev, ...filteredData]); setHasMore(filteredData.length === PAGE_SIZE); }
      else { setOpportunities(filteredData); setHasMore(filteredData.length === PAGE_SIZE); }
    } catch (error: any) { console.error('Error loading opportunities:', error); setError(error.message || 'Failed to load opportunities'); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { loadOpportunities(); }, [selectedCategory]);
  useEffect(() => { if (userLocation) loadOpportunities(); }, [userLocation]);

  // Filtered opportunities
  const filteredOpportunities = useMemo(() => {
    if (opportunities.length === 0) return [];
    let results = [...opportunities];

    if (selectedQuickFilter === 'trending') results.sort((a, b) => ((b.spotsTotal - b.spotsAvailable) || 0) - ((a.spotsTotal - a.spotsAvailable) || 0));
    else if (selectedQuickFilter === 'filling') results = results.filter(opp => opp.spotsAvailable > 0 && opp.spotsAvailable <= 5).sort((a, b) => a.spotsAvailable - b.spotsAvailable);
    else if (selectedQuickFilter === 'saved') results = results.filter(opp => savedOpportunityIds.includes(opp.id));

    if (dateRange !== 'all') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (dateRange === 'today') results = results.filter(opp => { const d = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null; if (!d) return false; const dd = new Date(d); dd.setHours(0,0,0,0); return dd.getTime() === today.getTime(); });
      else if (dateRange === 'thisWeek') { const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7); results = results.filter(opp => { const d = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null; return d && new Date(d) >= today && new Date(d) <= weekEnd; }); }
      else if (dateRange === 'thisMonth') { const monthEnd = new Date(today); monthEnd.setMonth(monthEnd.getMonth() + 1); results = results.filter(opp => { const d = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null; return d && new Date(d) >= today && new Date(d) <= monthEnd; }); }
    }

    if (minSpotsAvailable !== undefined) results = results.filter(opp => opp.spotsAvailable >= minSpotsAvailable);
    if (organizationVerified !== undefined) results = results.filter(opp => opp.organizationVerified === organizationVerified);
    if (maxDistance !== undefined && userLocation) results = results.filter(opp => opp.distance !== undefined && opp.distance <= maxDistance);

    if (sortBy === 'date') results.sort((a, b) => (a.dateEnd ? new Date(a.dateEnd) : a.date ? new Date(a.date) : new Date(0)).getTime() - (b.dateEnd ? new Date(b.dateEnd) : b.date ? new Date(b.date) : new Date(0)).getTime());
    else if (sortBy === 'spots') results.sort((a, b) => b.spotsAvailable - a.spotsAvailable);
    else if (sortBy === 'distance' && userLocation) results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    if (selectedCategory === 'nearMe') {
      results = results.filter(opp => opp.latitude && opp.longitude);
      const hasDistances = results.some(opp => opp.distance !== undefined);
      if (hasDistances) { results = results.filter(opp => opp.distance !== undefined && opp.distance <= (maxDistance || 30)); if (sortBy !== 'distance') results.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)); }
    }

    results = searchOpportunities(results, { query: searchQuery, category: selectedCategory !== 'all' && selectedCategory !== 'nearMe' ? selectedCategory : undefined, dateRange: dateRange !== 'all' ? dateRange as any : undefined, maxDistance, minSpotsAvailable, organizationVerified, sortBy: sortBy as any });
    if (searchQuery.trim()) trackSearchAnalytics(searchQuery, results.length);
    return results;
  }, [opportunities, selectedCategory, selectedQuickFilter, savedOpportunityIds, searchQuery, dateRange, maxDistance, minSpotsAvailable, organizationVerified, sortBy, userLocation]);

  const debouncedSearchQuery = useDebounce(searchInputValue, 300);
  const suggestions = useMemo(() => opportunities.length === 0 || !debouncedSearchQuery || debouncedSearchQuery.trim().length < 2 ? [] : generateSearchSuggestions(opportunities, debouncedSearchQuery, 5), [debouncedSearchQuery, opportunities]);

  // Handlers
  const handleOpportunityPress = useCallback((opportunity: Opportunity) => { trackSearchAnalytics(searchQuery, filteredOpportunities.length, opportunity.id); router.push(`/opportunity/${opportunity.id}`); }, [router, searchQuery, filteredOpportunities.length]);
  const handleToggleSave = useCallback(async (opportunity: Opportunity) => {
    if (!user) return;
    const isSaved = savedOpportunityIds.includes(opportunity.id);
    try {
      if (isSaved) { const { error } = await supabase.from('saved_opportunities').delete().eq('user_id', user.id).eq('opportunity_id', opportunity.id); if (!error) setSavedOpportunityIds(prev => prev.filter(id => id !== opportunity.id)); }
      else { const { error } = await supabase.from('saved_opportunities').insert({ user_id: user.id, opportunity_id: opportunity.id }); if (!error) setSavedOpportunityIds(prev => [...prev, opportunity.id]); }
    } catch (error) { console.error('Error toggling save:', error); }
  }, [user, savedOpportunityIds]);
  const handleShareOpportunity = useCallback((opportunity: Opportunity) => { router.push(`/opportunity/${opportunity.id}`); }, [router]);

  const renderLeftActions = useCallback((opportunity: Opportunity) => {
    const isSaved = savedOpportunityIds.includes(opportunity.id);
    const swipeableRef = swipeableRefs.current.get(opportunity.id);
    return <SwipeActions isSaved={isSaved} onSave={() => { handleToggleSave(opportunity); swipeableRef?.close(); }} onShare={() => { handleShareOpportunity(opportunity); swipeableRef?.close(); }} colors={colors} />;
  }, [savedOpportunityIds, handleToggleSave, handleShareOpportunity, colors]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchInputValue(text);
    setShowSuggestions(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => { setSearchQuery(text); if (text.trim()) { saveSearchToHistory(text.trim()); loadSearchHistory(); } }, 300);
  }, []);

  const handleClearSearch = useCallback(() => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); setSearchInputValue(''); setSearchQuery(''); setShowSuggestions(false); setTimeout(() => searchInputRef.current?.focus(), 50); }, []);
  const handleSelectSuggestion = useCallback((suggestion: string) => { setSearchInputValue(suggestion); setSearchQuery(suggestion); setShowSuggestions(false); saveSearchToHistory(suggestion); loadSearchHistory(); }, []);
  const handleSelectCategory = useCallback((category: string) => { setSelectedCategory(category as any); setSelectedQuickFilter(null); loadOpportunities(); }, []);
  const handleSelectQuickFilter = useCallback(async (filterId: string) => { if (selectedQuickFilter === filterId) { setSelectedQuickFilter(null); return; } setSelectedQuickFilter(filterId); setSelectedCategory('all'); if (filterId === 'saved') await loadSavedOpportunityIds(); }, [selectedQuickFilter, loadSavedOpportunityIds]);
  const handleApplyFilters = useCallback(() => { loadOpportunities(); }, []);
  const handleLoadMore = useCallback(() => { if (!loadingMore && hasMore && !searchQuery.trim()) loadOpportunities(true); }, [loadingMore, hasMore, searchQuery]);

  useEffect(() => { return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }; }, []);
  useFocusEffect(React.useCallback(() => { loadOpportunities(); }, []));

  const filterCounts = useMemo(() => ({
    trending: opportunities.length > 0 ? Math.min(opportunities.length, 12) : 0,
    filling: opportunities.filter(o => o.spotsAvailable > 0 && o.spotsAvailable <= 5).length,
    saved: savedOpportunityIds.length,
  }), [opportunities, savedOpportunityIds]);

  const renderHeaderContent = useCallback(() => (
    <View style={styles.headerContainer}>
      {isSearchExpanded && (
        <View style={styles.searchBarContainer}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <EnhancedSearchBar searchQuery={searchInputValue} onSearchChange={handleSearchChange} onClearSearch={() => { handleClearSearch(); if (!searchInputValue.trim()) { setIsSearchExpanded(false); Keyboard.dismiss(); } }} searchInputRef={searchInputRef} colors={colors} onFocus={() => setShowSuggestions(true)} onBlur={() => { if (!searchInputValue.trim() && !showSuggestions) setIsSearchExpanded(false); }} onHideSuggestions={() => setShowSuggestions(false)} searchBarRef={searchBarRef} onLayout={(event) => { const { y, height } = event.nativeEvent.layout; setSearchBarLayout({ y, height }); }} />
          </View>
          <Pressable onPress={() => { setIsSearchExpanded(false); setShowSuggestions(false); Keyboard.dismiss(); }} style={({ pressed }) => [styles.closeSearchButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>
      )}

      {searchQuery.trim() && (
        <View style={[styles.searchInfoBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.searchInfoText, { color: colors.textSecondary }]}>{filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'result' : 'results'}{searchQuery && ` for "${searchQuery}"`}</Text>
          <Pressable onPress={() => setShowFilters(!showFilters)} style={({ pressed }) => [styles.filterToggleButton, { backgroundColor: showFilters ? colors.primarySoft : colors.card, borderColor: showFilters ? colors.primary : colors.border }, pressed && { opacity: 0.7 }]}>
            <SlidersHorizontal size={16} color={showFilters ? colors.primary : colors.textSecondary} />
            <Text style={[styles.filterToggleText, { color: showFilters ? colors.primary : colors.textSecondary }]}>Filters</Text>
          </Pressable>
        </View>
      )}

      <FilterPanel visible={showFilters} onClose={() => { handleApplyFilters(); setShowFilters(false); }} colors={colors} dateRange={dateRange} onDateRangeChange={setDateRange} maxDistance={maxDistance} onMaxDistanceChange={setMaxDistance} minSpotsAvailable={minSpotsAvailable} onMinSpotsAvailableChange={setMinSpotsAvailable} organizationVerified={organizationVerified} onOrganizationVerifiedChange={setOrganizationVerified} sortBy={sortBy} onSortByChange={setSortBy} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
        {CATEGORIES.map((item) => <AnimatedFilterChip key={item.value} label={item.label} isSelected={selectedCategory === item.value && !selectedQuickFilter} onPress={() => { handleSelectCategory(item.value); setSelectedQuickFilter(null); }} colors={colors} showMapPin={item.value === 'nearMe'} />)}
        <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
        {QUICK_FILTERS.map((filter) => <AnimatedFilterChip key={filter.id} label={filter.label} isSelected={selectedQuickFilter === filter.id} onPress={() => { handleSelectQuickFilter(filter.id); setSelectedCategory('all'); }} colors={colors} icon={filter.icon} count={filterCounts[filter.id as keyof typeof filterCounts]} />)}
      </ScrollView>
    </View>
  ), [colors, isSearchExpanded, searchInputValue, searchQuery, showSuggestions, showFilters, selectedCategory, selectedQuickFilter, filterCounts, filteredOpportunities.length, dateRange, maxDistance, minSpotsAvailable, organizationVerified, sortBy, handleSearchChange, handleClearSearch, handleSelectCategory, handleSelectQuickFilter, handleApplyFilters]);

  const renderEmptyComponent = useCallback(() => {
    if (loading) return <View style={styles.listContent}><OpportunitiesSkeleton count={4} /></View>;
    if (error) return <EmptyState icon={X} title="Error loading opportunities" subtitle={error} action={{ label: 'Retry', onPress: () => loadOpportunities() }} colors={colors} />;
    if (searchQuery.trim() && filteredOpportunities.length === 0) return <EmptyState icon={Search} title="No results for that search" subtitle={`We couldn't find opportunities matching "${searchQuery}"`} action={{ label: 'Clear Search', onPress: () => { setSearchQuery(''); setSearchInputValue(''); setSelectedQuickFilter(null); } }} suggestions={['Try different keywords', 'Browse all opportunities']} colors={colors} />;
    if (selectedCategory !== 'all' && filteredOpportunities.length === 0) return <EmptyState icon={Filter} title="No opportunities in this category" subtitle={`There are no ${selectedCategory} opportunities right now`} action={{ label: 'View All', onPress: () => handleSelectCategory('all') }} colors={colors} />;
    if (selectedQuickFilter && filteredOpportunities.length === 0) return <EmptyState icon={selectedQuickFilter === 'saved' ? Bookmark : TrendingUp} title={`No ${QUICK_FILTERS.find(f => f.id === selectedQuickFilter)?.label || ''} opportunities`} subtitle="Try a different filter" action={{ label: 'View All', onPress: () => { setSelectedQuickFilter(null); handleSelectCategory('all'); } }} colors={colors} />;
    return <EmptyState icon={Lightbulb} title="Discover volunteer opportunities" subtitle="Browse and find opportunities that match your interests" action={{ label: 'Browse Categories', onPress: () => handleSelectCategory('all') }} colors={colors} />;
  }, [loading, error, colors, searchQuery, selectedCategory, selectedQuickFilter, filteredOpportunities.length, handleSelectCategory]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable style={[styles.container, { backgroundColor: colors.background }]} onPress={() => { if (showSuggestions) { setShowSuggestions(false); Keyboard.dismiss(); } }}>
        <Head><title>Discover | VIbe</title></Head>
        {!isDesktop && <ScreenHeader colors={colors} insets={insets} onSearchPress={() => setIsSearchExpanded(true)} />}
        <WebContainer>
          <AnimatedTabBar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setTabCache(prev => ({ ...prev, [tab]: true })); }} colors={colors} />

          <View style={[styles.tabContent, activeTab !== 'opportunities' && styles.tabContentHidden]}>
            {selectedCategory === 'nearMe' && !locationPermission && !requestingLocation && <LocationBanner type="permission" colors={colors} onEnable={getUserLocation} />}
            {selectedCategory === 'nearMe' && requestingLocation && <LocationBanner type="loading" colors={colors} />}
            <View style={styles.searchHeaderContainer}>{renderHeaderContent()}</View>
            <SuggestionsDropdown visible={showSuggestions} suggestions={suggestions} colors={colors} onSelectSuggestion={handleSelectSuggestion} topPosition={searchBarLayout.y + searchBarLayout.height + 4} />
            <FlatList
              ref={listRef}
              data={filteredOpportunities}
              keyExtractor={(item) => item.id}
              numColumns={width >= 600 ? 2 : 1}
              key={width >= 600 ? '2-col' : '1-col'}
              renderItem={({ item }) => (
                <Swipeable ref={(ref) => { if (ref) swipeableRefs.current.set(item.id, ref); else swipeableRefs.current.delete(item.id); }} renderLeftActions={() => renderLeftActions(item)} overshootLeft={false} friction={2}>
                  <OpportunityCard opportunity={item} onPress={handleOpportunityPress} />
                </Swipeable>
              )}
              contentContainerStyle={[styles.listContent, width >= 600 && styles.listContentGrid]}
              columnWrapperStyle={width >= 600 ? styles.columnWrapper : undefined}
              refreshControl={<RefreshControl refreshing={loading && !loadingMore} onRefresh={() => loadOpportunities()} tintColor={colors.primary} colors={[colors.primary]} />}
              ListEmptyComponent={renderEmptyComponent}
              ListFooterComponent={loadingMore ? <LoadingFooter colors={colors} /> : null}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={activeTab === 'opportunities'}
            />
          </View>

          <View style={[styles.tabContent, activeTab !== 'causes' && styles.tabContentHidden]}>
            <CausesList showSearch={false} showFilters={true} onCausePress={(cause) => router.push(`/causes/${cause.id}`)} />
          </View>

          <View style={[styles.tabContent, activeTab !== 'events' && styles.tabContentHidden]}>
            <EventsList showSearch={false} showFilters={true} />
          </View>
        </WebContainer>
      </Pressable>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontWeight: '700', letterSpacing: -0.5 },
  searchIconButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  closeSearchButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  searchWrapper: { position: 'relative', zIndex: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12 },
  clearButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  suggestionsDropdownWrapper: { position: 'absolute', left: 16, right: 16, zIndex: 9999, elevation: 10, borderRadius: 16, borderWidth: 1, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 }, android: { elevation: 8 } }) },
  suggestionsContainer: { maxHeight: 300 },
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8, borderBottomWidth: 1 },
  suggestionsHeaderText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 12 },
  suggestionIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  suggestionText: { fontSize: 15, flex: 1 },
  searchInfoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12, borderRadius: 12, borderWidth: 1 },
  searchInfoText: { fontSize: 13, fontWeight: '500' },
  filterToggleButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 6 },
  filterToggleText: { fontSize: 13, fontWeight: '600' },
  headerContainer: { paddingBottom: 8 },
  searchHeaderContainer: { backgroundColor: 'transparent', zIndex: 1, paddingHorizontal: 16, paddingTop: 12 },
  filtersScrollContent: { paddingVertical: 8, gap: 8 },
  filterDivider: { width: 1, height: 24, marginHorizontal: 8, alignSelf: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, position: 'relative' },
  chipCheckmark: { marginRight: 6 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  filterChipTextSelected: { fontWeight: '600' },
  filterChipBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 6, paddingHorizontal: 6 },
  filterChipBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  filterPanel: { marginBottom: 16, padding: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 4 } }) },
  filterPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filterPanelTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterPanelTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  filterCloseButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  filterSection: { marginBottom: 20 },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10, letterSpacing: -0.2 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabBar: { borderBottomWidth: 1, paddingVertical: 8, position: 'relative' },
  tabBarContent: { paddingHorizontal: 16, gap: 4, position: 'relative' },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, borderRadius: 20, zIndex: 0 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 1 },
  tabText: { fontWeight: '500' },
  tabTextActive: { fontWeight: '600' },
  tabContent: { flex: 1 },
  tabContentHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 },
  locationBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 14, borderWidth: 1, gap: 12 },
  locationBannerText: { fontSize: 14, flex: 1, fontWeight: '500' },
  enableLocationButton: { borderRadius: 10, overflow: 'hidden' },
  enableLocationGradient: { paddingHorizontal: 16, paddingVertical: 8 },
  enableLocationButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  swipeActionsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 16, gap: 8 },
  swipeAction: { borderRadius: 14, overflow: 'hidden' },
  swipeActionGradient: { width: 72, height: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  swipeActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 4 },
  listContent: { padding: 8, flexGrow: 1 },
  listContentGrid: { padding: 8 },
  columnWrapper: { gap: 0 },
  loadingMoreContainer: { paddingVertical: 20, alignItems: 'center' },
  loadingMoreContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 10 },
  loadingMoreText: { fontSize: 13, fontWeight: '500' },
});
    ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
                      Loading more...
                    </Text>
                  </View>
                ) : null
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          {/* Causes Tab */}
          <View style={[styles.tabContent, activeTab !== 'causes' && styles.tabContentHidden]}>
            <CausesList
              showSearch={false}
              showFilters={true}
              onCausePress={(cause) => router.push(`/causes/${cause.id}`)}
            />
          </View>

          {/* Events Tab */}
          <View style={[styles.tabContent, activeTab !== 'events' && styles.tabContentHidden]}>
            <EventsList showSearch={false} showFilters={true} />
          </View>
        </WebContainer>
      </Pressable>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Tab Bar
  tabBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabBarInner: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 8,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabText: {
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },

  // Search
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchWrapper: {
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Suggestions
  suggestionsDropdown: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  suggestionsHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  suggestionText: {
    fontSize: 15,
    flex: 1,
  },

  // Filter Chips
  filtersScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontWeight: '500',
  },
  chipCheckmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
    alignSelf: 'center',
  },

  // Search Info Bar
  searchInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  searchInfoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Filter Panel
  filterPanel: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterPanelTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Location Banner
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  enableLocationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enableLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Swipe Actions
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 16,
  },
  swipeAction: {
    marginRight: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeActionGradient: {
    width: 75,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // List
  headerContainer: {
    paddingBottom: 8,
  },
  searchHeaderContainer: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  listContent: {
    padding: 8,
    flexGrow: 1,
  },
  listContentGrid: {
    padding: 8,
  },
  columnWrapper: {
    gap: 0,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
  },

  // Tabs
  tabContent: {
    flex: 1,
  },
  tabContentHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
  },

  // Skeleton
  skeletonContainer: {
    flex: 1,
  },
});
