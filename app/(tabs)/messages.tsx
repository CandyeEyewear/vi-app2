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
});